import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useWeb3 } from '../context/Web3Context';

interface Attr { trait_type: string; value: string; }

/**
 * In-app NFT metadata creator. The student enters name/description/image/attributes;
 * we POST to /api/ipfs/metadata which pins the image + the ERC-721 JSON to the
 * self-hosted IPFS node and returns an ipfs:// CID. onUploaded receives that CID so
 * the parent can append it to the mint list (one line per NFT).
 */
export default function MetadataBuilder({
  onUploaded,
  disabled,
}: {
  onUploaded: (uri: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  // т.4 (2026-10-31): pinning now requires a wallet signature that the server checks against the
  // on-chain whitelist. Until today the endpoint was open to anybody who could reach the URL.
  const { account, signer } = useWeb3();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [busy, setBusy] = useState(false);

  const pickImage = (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t('mb.tooBig', 'Image too large (max 5 MB)')); return; }
    // The server decides the type from the bytes; this is only to keep the picker honest.
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast.error(t('mb.badType', 'Only PNG, JPEG or WebP')); return; }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const addAttr = () => { if (attrs.length < 20) setAttrs([...attrs, { trait_type: '', value: '' }]); };
  const setAttr = (i: number, k: keyof Attr, v: string) =>
    setAttrs(attrs.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  const rmAttr = (i: number) => setAttrs(attrs.filter((_, j) => j !== i));

  const upload = async () => {
    if (!name.trim()) { toast.error(t('mb.needName', 'Enter a name')); return; }
    if (!imageDataUrl) { toast.error(t('mb.needImage', 'Choose an image')); return; }
    setBusy(true);
    try {
      const cleanAttrs = attrs
        .filter((a) => a.trait_type.trim() && String(a.value).trim())
        .map((a) => ({ trait_type: a.trait_type.trim(), value: a.value.trim() }));
      if (!account || !signer) { toast.error(t('mb.needWallet', 'Connect your wallet to pin to IPFS')); return; }

      // Sign a message that CONTAINS the hash of this exact image, so the signature cannot be
      // replayed with a different file. The server recomputes the hash from what it received.
      const b64 = imageDataUrl.split(',')[1] || '';
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const msgRes = await fetch(`/api/ipfs/upload-message?address=${account}&sha256=${sha256}`);
      const { message, error: msgErr } = await msgRes.json();
      if (!msgRes.ok) throw new Error(msgErr || 'message_failed');
      const signature = await signer.signMessage(message);

      const res = await fetch('/api/ipfs/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), description: description.trim(), image: imageDataUrl,
          attributes: cleanAttrs, address: account, signature,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'upload_failed');
      onUploaded(data.metadataUri);
      toast.success(t('mb.done', 'Pinned to IPFS — added to the mint list'));
      setName(''); setDescription(''); setImageDataUrl(''); setAttrs([]);
    } catch (e: any) {
      toast.error(t('mb.failed', 'Upload failed: {{e}}', { e: e?.message || 'error' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg p-4 mb-3" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(120,120,120,0.25)' }}>
      <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {t('mb.title', 'Create metadata in-app → IPFS')}
      </div>
      <input className="form-input mb-2" placeholder={t('mb.name', 'Name')} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      <textarea className="form-input mb-2" rows={2} placeholder={t('mb.desc', 'Description')} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      <input className="form-input mb-2" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => pickImage(e.target.files?.[0])} />
      {imageDataUrl && <img src={imageDataUrl} alt="preview" style={{ maxHeight: 120, borderRadius: 8, marginBottom: 8, display: 'block' }} />}
      <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('mb.attrs', 'Attributes (optional)')}</div>
      {attrs.map((a, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input className="form-input" style={{ flex: 1 }} placeholder={t('mb.trait', 'Trait')} value={a.trait_type} maxLength={50} onChange={(e) => setAttr(i, 'trait_type', e.target.value)} />
          <input className="form-input" style={{ flex: 1 }} placeholder={t('mb.value', 'Value')} value={a.value} maxLength={200} onChange={(e) => setAttr(i, 'value', e.target.value)} />
          <button type="button" className="btn-flat" onClick={() => rmAttr(i)}>{t('mb.remove', 'Remove')}</button>
        </div>
      ))}
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn-flat" onClick={addAttr} disabled={attrs.length >= 20}>{t('mb.addAttr', '+ Attribute')}</button>
        <button type="button" className="btn-flat primary" onClick={upload} disabled={busy || disabled}>
          {busy ? t('mb.uploading', 'Uploading…') : t('mb.upload', 'Upload & add to mint list')}
        </button>
      </div>
      {disabled && <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>{t('mb.full', 'Mint list is full (max per batch reached).')}</div>}
    </div>
  );
}
