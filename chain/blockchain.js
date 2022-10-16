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

Blockchain.prototype.createNewTransaction = function(amount, senser, recipient) {
    const newTransaction = {
        amount: amount,
        senser: senser,
        recipient: recipient,
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

module.exports = Blockchain;