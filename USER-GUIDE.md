# 📚 EduChain User Guide
## Complete guide for using the educational Web3 platform

**🇬🇧 English | 🇧🇬 [Български](USER-GUIDE-bg.md)**

---

## 🚀 Getting Started - How to Get Access?

### 📝 For Testing Environment (Sepolia Network)

**Anyone who wants to test EduChain must:**

1. **Fill out the contact form** at [school.slavy.space/contact](https://school.slavy.space/contact)
2. **Describe in detail:**
   - Your purpose for testing
   - Why you want access to the platform
   - Whether you're a teacher, student, parent, or researcher
   - Your experience with Web3 technologies (if any)
3. **Provide your wallet address** (MetaMask or another Ethereum wallet)

**Example of a good request:**

Name: Maria Petrova
Organization: "Hristo Botev" High School, Sofia
Purpose: Testing the platform for integration in computer science classes
Why: I want to prepare my students for the digital future
Wallet address: 0x1234...5678

### 🏫 For Production Phase

**Hierarchical access:**
- **Owner** → creates **Admins** (teachers)
- **Admins** → add their **Students**
- **Students** → use all platform features

---

## 👨‍🏫 For Teachers (Admins)

### 🔐 Basic Teacher Functions

#### 1. **Adding a Student**

**Step by step:**

1. **Go to Admin Dashboard** (button appears in menu after login)
2. **Find the "Add User to Whitelist" section**
3. **Enter the student's wallet address** (you need to ask them for it in advance)
4. **Click "Add User"**
5. **Sign the transaction** in MetaMask
6. **Wait for confirmation** - you'll see a green success message

**💡 Important:** Students must first install MetaMask and give you their address!

#### 2. **Removing a Student**

**Step by step:**

1. **Go to the same Admin Dashboard section**
2. **Find "Remove User from Whitelist"**
3. **Enter the student's wallet address**
4. **Click "Remove User"**
5. **Sign the transaction**
6. **Check the result** - the student will no longer have access

#### 3. **Batch Adding (Batch Add)**

**For adding many students at once:**

1. **Prepare a list of addresses** separated by commas
2. **Enter in the "Batch Add" field:**
0x1234...5678, 0xabcd...efgh, 0x9876...5432
3. **Click "Add Batch"**
4. **Sign the transaction** (may be more expensive due to more operations)

#### 4. **Checking a Student**

**To check if a student has access:**

1. **Enter the address in "Check User"**
2. **Click "Check"**
3. **Result will show:** ✅ Whitelisted or ❌ Not whitelisted

---

## 👨‍🎓 For Students

### 🎮 Shop Page - Creating Digital Assets

On the Shop page you have **3 main options:**

---

#### 🎨 **1. Predefined NFTs**

**What they are:** NFTs with ready-made designs and metadata, prepared by teachers

**Step by step process:**

1. **Select the "Predefined NFTs" tab**
2. **Browse available designs** - you'll see NFT previews
3. **Check the price** (shown in ETH)
4. **Check how many you can create** (limit of 3 per day)
5. **Click "Mint NFT"**
6. **In MetaMask:**
   - Check that the amount is correct
   - Check the gas fees
   - Click "Confirm"
7. **Wait for the transaction** - you'll see a loading animation
8. **Success!** Your NFT is created and in your portfolio

**💡 Children, be careful:** 
- You can only create 3 NFTs per day
- The limit resets after 24 hours
- Each NFT costs a little ETH (test ETH for Sepolia)
- Each Predefined NFT gives you **1 point**

---

#### 🖌️ **2. Custom NFTs**

**What they are:** NFTs that you create with your own images and descriptions

**Step by step process:**

1. **Select the "Custom NFTs" tab**
2. **Prepare your image:**
   - Can be a drawing, photo, or digital art
   - Recommended size: square (500x500 pixels)
   - Format: JPG, PNG, GIF
3. **Upload the image to IPFS or another service** (your teacher will explain how)
4. **Copy the image URL** (must start with https://)
5. **Enter the URL in the "Token URI" field**
6. **Write a name for your NFT**
7. **Add a description** (what it represents, why you're creating it)
8. **Check the price** (usually more expensive than predefined)
9. **Choose payment method:**
   - **Regular mint:** Pay with ETH (0.03 ETH)
   - **Batch mint:** Pay with GameToken (1 token per NFT, NO ETH!)
10. **Click "Mint Custom NFT"** or **"Batch Mint with Tokens"**
11. **Sign the transaction** in MetaMask
12. **Wait for confirmation** - your unique NFT is ready!

**💡 For children:**
- This is the most creative part - you can create whatever you want!
- Make sure your image is appropriate for school
- Keep the image URL - if it's lost, your NFT won't display correctly
- Each Custom NFT gives you **3 points**

**🎯 Batch Minting with GameToken:**
- You can mint NFTs for yourself AND other students
- Maximum 2 addresses per transaction
- Pay ONLY with GameToken (1 token per NFT)
- NO ETH required for batch minting!
- Perfect for group projects

---

#### 💰 **3. Game Tokens - ERC20 Tokens**

**What they are:** Digital coins you can use on the platform for purchases

**Step by step process:**

1. **Select the "Buy Tokens" tab**
2. **Enter how many tokens you want** (example: 100)
3. **The system will calculate the price** automatically
4. **Review the details:**
   - How many tokens you'll receive
   - How much ETH you'll pay
   - How many purchases you can make per day (limit 3)
5. **Click "Buy Tokens"**
6. **In MetaMask confirm:**
   - The payment amount
   - The gas fees
   - Click "Confirm"
7. **Wait for the transaction**
8. **Check your balance** - tokens will appear in your portfolio

**💡 Useful tips:**
- You can use tokens to purchase NFTs from other students
- The limit of 3 purchases per day protects you from spending too much
- Always check your balance before purchasing
- Each whole token gives you **1 point**

---

## 🛒 Marketplace - Trading NFTs

### 📋 Creating a Listing

**How to sell your NFT:**

**Step by step:**

1. **Go to the Marketplace page**
2. **Click "Create Listing"**
3. **Select the NFT** you want to sell (from dropdown menu)
4. **Enter the price** in ETH (example: 0.05)
5. **Choose sale type:**
   - **Public** - anyone can buy
   - **Private** - only a specific person can buy (enter their address)
6. **Review the listing details**
7. **Click "Create Listing"**

**💡 IMPORTANT - Approval process:**

8. **First, an Approve transaction will appear:**
   - This gives the Marketplace permission to manage your NFT
   - Click "Confirm" in MetaMask
   - This is one-time - you won't need it again for the same NFT
9. **After approval, a second transaction will appear:**
   - This actually creates the listing
   - Confirm this transaction too
10. **Done!** Your listing is active and others can see it

---

### 💳 Buying from Marketplace

**How to buy an NFT from another student:**

**Step by step:**

1. **Browse available listings** on the Marketplace page
2. **Select an NFT you like**
3. **Click on it** to see details
4. **Review the information:**
   - Price
   - Description
   - Who's selling it
   - Whether it's public or private
5. **Click "Buy NFT"**
6. **In MetaMask:**
   - Check you're paying the right amount
   - Confirm the transaction
7. **Wait for confirmation**
8. **Success!** The NFT is now yours and you'll see it in Gallery

**💡 Important things:**
- Make sure you have enough ETH in your wallet
- After buying an NFT, you can't get your money back
- The NFT immediately transfers to your wallet

---

## 🖼️ Gallery Page - Your Collection

### Tab 1: My Assets

**What you'll see:**
- **All your tokens** - GameToken balance
- **NFT counts** - how many predefined and custom NFTs you own
- **Points overview** - total points and breakdown by asset type
- **Portfolio summary** - complete statistics

**Features:**
- View your ERC20 token balance
- See how many points each asset type gives you
- Track your total points for the leaderboard

### Tab 2: Full Portfolio (Moralis Integration)

**Complete NFT gallery with advanced features:**

#### 🔍 Smart Filters:

**☑️ Only with Images**
- Hides NFTs without media files
- Shows only NFTs with valid images
- Perfect for visual browsing

**☑️ School System Only**
- Shows only NFTs from EduChain contracts
- Filters out external NFTs
- Focus on your educational assets

**☑️ Filter by Contract**
- Enter a specific contract address
- View NFTs from that contract only
- Great for project-specific viewing

#### 🖼️ NFT Card Features:

**For each NFT you can:**
- **View Image** - click to zoom full-size
- **Preview Metadata** - see JSON data in modal
- **View JSON File** - open full metadata in new tab
- **View Contract** - link to Etherscan
- **Copy Address** - quick clipboard copy

#### 📊 Pagination:
- Choose 10, 25, 50, or 100 items per page
- Navigate with Previous/Next buttons
- See total NFT count

**💡 Gallery Tips:**
- Images are protected from copying
- IPFS URLs are automatically converted
- Metadata loads on-demand
- Works with all Sepolia NFTs in your wallet

---

## 🏆 Leaderboard System

### Two Leaderboard Types:

#### 1. Simple Leaderboard (`/leaderboard`)

**Quick rankings view:**
- Top 10, 25, 50, or 100 users
- Auto-refresh every 15 seconds
- Your personal stats card
- Current rank display
- Real-time point calculation

**Features:**
- 🪙 See everyone's ERC20 balance
- 🖼️ View Predefined NFT counts
- 🎨 Check Custom NFT totals
- 🏆 Live point rankings

**Your Stats Card Shows:**
- Your total points
- Your current rank
- Breakdown by asset type
- Real-time updates

---

#### 2. Advanced Rankings (`/rankings`)

**Comprehensive ranking system with filters:**

**📊 Statistics Overview:**
- Total users in system
- Filtered results count
- Currently displayed users
- Last update time

**🔍 Advanced Filters:**

1. **Search by Address**
   - Enter full or partial wallet address
   - Find specific users quickly
   - Case-insensitive search

2. **Minimum Points**
   - Set a point threshold
   - Show only top performers
   - Filter by achievement level

3. **Rank Range**
   - View positions X to Y
   - Example: Ranks 10 to 50
   - Custom range selection

4. **Sort Options**
   - By Rank (Points)
   - By Total Points
   - By ERC20 Tokens
   - By Predefined NFTs
   - By Custom NFTs

5. **Sort Order**
   - Descending (High to Low)
   - Ascending (Low to High)

6. **Items Per Page**
   - 10, 25, 50, 100, or All
   - Pagination controls
   - Navigate through pages

**⚙️ Additional Features:**
- **Auto-refresh** - optional 30-second updates
- **Manual refresh** - update on demand
- **Copy address** - one-click clipboard
- **Clear filters** - reset all filters

---

## 💧 Faucet - Getting Test ETH

**How to get Sepolia ETH:**

1. **Go to Faucet page**
2. **Make sure you're whitelisted**
3. **Click "Claim ETH"**
4. **Receive 0.05 ETH**
5. **Wait 24 hours** before next claim

**💡 Faucet Rules:**
- 0.05 ETH per claim
- 24-hour cooldown
- Only for whitelisted users
- ETH-only (no tokens/NFTs)

---

## 🎯 Point System Explained

### How Points Work:

| Asset Type | Points |
|-----------|--------|
| 🪙 GameToken (ERC20) | 1 point per whole token |
| 🖼️ Predefined NFT | 1 point per NFT |
| 🎨 Custom NFT | 3 points per NFT |

### Point Calculation:
- **Real-time** - calculated from live blockchain data
- **No gas fees** - pure view functions
- **Automatic** - updates every 15-30 seconds
- **Transparent** - see exact breakdown

### Example:
If you have:
- 10 GameTokens = 10 points
- 2 Predefined NFTs = 2 points
- 1 Custom NFT = 3 points
- **Total = 15 points**

---

## 🆘 Common Problems & Solutions

### ❌ **"Transaction failed" error**
**Solution:** 
- Check if you have enough ETH for gas
- Increase gas limit in MetaMask
- Try again after a few minutes

### ❌ **"Not whitelisted" error**
**Solution:**
- Check if your teacher added you correctly
- Make sure you're using the same wallet address
- Ask your teacher to verify your status

### ❌ **NFT doesn't show up**
**Solution:**
- Wait a few minutes - sometimes it takes time
- Refresh the page
- Check if the image URL works
- Try the Full Portfolio tab

### ❌ **MetaMask won't connect**
**Solution:**
- Make sure you're on Sepolia network
- Click "Connect Wallet" again
- Restart your browser
- Clear MetaMask cache

### ❌ **Image won't load in NFT**
**Solution:**
- Check if the image URL is valid
- Try opening the URL in a new tab
- Make sure it's not an IPFS timeout
- Contact your teacher for help

### ❌ **Rankings show 0 users**
**Solution:**
- Wait for data to load
- Click the Refresh button
- Make sure contracts are deployed
- Check browser console (F12) for errors

---

## 🔒 Security - Important Rules

### ✅ **Always do:**
- Check addresses before sending transactions
- Keep your seed phrase secret
- Ask your teacher if you're unsure
- Use only test ETH on Sepolia

### ❌ **Never do:**
- Don't share your private key or seed phrase
- Don't send ETH to unknown addresses  
- Don't click suspicious links
- Don't use real ETH on mainnet

---

## 🎓 Learning Tips

### For Best Results:

1. **Start small** - claim faucet ETH first
2. **Buy a few tokens** - understand transactions
3. **Mint a predefined NFT** - learn the basics
4. **Try marketplace** - practice buying and selling
5. **Create custom NFT** - express your creativity
6. **Check leaderboard** - compete with classmates
7. **Use filters** - explore your full portfolio

### Educational Goals:
- Understand blockchain transactions
- Learn wallet management
- Practice digital asset creation
- Develop marketplace skills
- Compete and collaborate

---

## 📞 Support

**If you have problems:**

1. **First check here** in this guide
2. **Ask your teacher**
3. **Use the contact form** at school.slavy.space/contact
4. **Describe the problem** and what you were doing

---

## 🎉 Have Fun!

EduChain is a place for learning and experimenting. Don't be afraid to try new things - everything is in a safe test environment!

**Remember:** The goal is to learn how Web3 technologies work, so be curious and ask questions! 

---

**🇬🇧 English | 🇧🇧 [Switch to Bulgarian](USER-GUIDE-bg.md)**

*This guide is updated regularly. Last update: October 2025*
