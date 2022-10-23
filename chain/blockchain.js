const sha256 = require("sha256");
const { v4: uuidv4 } = require('uuid');
const currentNodeUrl = process.argv[3];

function Blockchain() {
    this.chain = [];
    this.pendingTransactions = [];

    this.currentNodeUrl = currentNodeUrl;
    this.networkNodes = [];

    this.createNewBlock(1337, "", "Hello world!")
}

Blockchain.prototype.createNewBlock = function(nonce, previousBlockHash, dataHash) {
    const newBlock = {
        number: this.chain.length + 1,
        timestamp: Date.now(),
        transactions: this.pendingTransactions,
        nonce: nonce,
        hash: dataHash,
        previousBlockHash: previousBlockHash
    };

    this.pendingTransactions = [];
    this.chain.push(newBlock);

    return newBlock;
}

Blockchain.prototype.getLastBlock = function() {
    return this.chain[this.chain.length-1];
}

Blockchain.prototype.createNewTransaction = function(amount, senser, recepient) {
    const newTransaction = {
        amount: amount,
        senser: senser,
        recepient: recepient,
        transactionId: uuidv4().split("-").join("")
    };

    return newTransaction
}

Blockchain.prototype.addTransactionToPendingTransactions = function(txObject) {
    this.pendingTransactions.push(txObject);
    return this.getLastBlock()["number"] + 1;
}

Blockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce) {
    const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
    const hash = sha256(dataAsString);
    return hash;
}

Blockchain.prototype.proofOfWork = function(previousBlockHash, currentBlockData) {
    let nonce = 0;
    let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce)
    while (hash.substring(0, 4) != "0000") {
        nonce++
        hash = this.hashBlock(previousBlockHash, currentBlockData, nonce)
    }
    return nonce;
}

Blockchain.prototype.chainIsValid = function(blockchain) {
    let validChain = true;

    for (let i = 1; i < blockchain.length; i++) {
        const currentBlock = blockchain[i];
        const prevBlock = blockchain[i - 1];
        const blockHash = this.hashBlock(prevBlock["hash"], {
            transactions: currentBlock["transactions"],
            number: currentBlock["number"]
        },
            currentBlock["nonce"]
        )
        if (blockHash.substring(0, 4) !== "0000") {
            validChain = false;
        } 
        if (currentBlock["previousBlockHash"] !== prevBlock["hash"]) {
            validChain = false;
        }
    }

    const genesisBlock = blockchain[0]
    const correctNonce = genesisBlock["nonce"]
    const correctPreviousBlockHash = genesisBlock["previousBlockHash"] === "";
    const correctHash = genesisBlock["hash"] === "Hello world!";
    const correctTransactions = genesisBlock["transactions"].length === 0;

    if (!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions) {
        validChain = false;
    }

    return validChain;
}

Blockchain.prototype.getBlock = function(blockHash) {
    let correctBlock = null;
    this.chain.forEach(block => {
        if (block.hash === blockHash) correctBlock = block;
    })
    return correctBlock;
}

Blockchain.prototype.getTransaction = function(transactionId) {
    let correctTransaction = null;
    let correctBlock = null;
    this.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            if (transaction.transactionId == transactionId) {
                correctTransaction = transaction;
                correctBlock = block;
            }
        })
    })
    return { 
        transaction: correctTransaction,
        block: correctBlock
     }
}

Blockchain.prototype.getAddressData = function(address) {
    const addressTransactions = [];
    this.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            if (transaction.senser === address || transaction.recepient === address) {
                addressTransactions.push(transaction)
            }
        })
    })
    let balance = 0;
    addressTransactions.forEach(transaction => {
        if (transaction.recepient === address) balance += transaction.amount;
        else if (transaction.senser === address) balance -= transaction.amount;
    })

    return {
        addressTransactions: addressTransactions,
        addressBalance: balance
    }
}

module.exports = Blockchain;