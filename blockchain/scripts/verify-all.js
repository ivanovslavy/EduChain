const { run } = require("hardhat");
const d = require("../deployed/latest.json");
(async () => {
  for (const [name, c] of Object.entries(d.contracts)) {
    try {
      await run("verify:verify", { address: c.address, constructorArguments: c.args || [] });
      console.log(`✅ ${name} verified`);
    } catch (e) {
      const m = (e.message || "").toLowerCase();
      if (m.includes("already verified")) console.log(`✅ ${name} already verified`);
      else console.log(`⚠️  ${name}: ${(e.message||"").split("\n")[0].slice(0,120)}`);
    }
  }
})();
