const express = require("express");
const bodyParser = require("body-parser");
const Blockchain = require("../chain/blockchain")
const { v4: uuidv4 } = require("uuid");
const chain = new Blockchain();
const port = process.argv[2];
const rp = require("request-promise");
const path = require("path")
const app = express();

//get current bode address
const nodeAddress = uuidv4().split("-").join("")

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//returns whole blockchain
app.get("/blockchain", (req, res) => {
    res.send(chain)
})

//creates new transaction
app.post("/transaction", (req, res) => {
    const newTransaction = req.body;
    const blockIndex = chain.addTransactionToPendingTransactions(newTransaction);
    res.json({ note: `Transaction will be added in block ${blockIndex}` })
})

//create and broadcast new transaction
app.post("/transaction/broadcast", (req, res) => {
    const newTransaction = chain.createNewTransaction(req.body.amount, req.body.sender, req.body.recepient);
    chain.addTransactionToPendingTransactions(newTransaction);
    const requestPromises = [];
    chain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + "/transaction",
            method: "POST",
            body: newTransaction,
            json: true
        }
        requestPromises.push(rp(requestOptions));
    })
    Promise.all(requestPromises)
        .then(data => {
            res.json({ note: "Transaction created and broadcasted" })
        })
})

// mine a block
app.get("/mine", function (req, res) {
    const lastBlock = chain.getLastBlock();
    const previousBlockHash = lastBlock["hash"];
    const currentBlockData = {
        transactions: chain.pendingTransactions,
        number: lastBlock["number"] + 1
    };
    const nonce = chain.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = chain.hashBlock(previousBlockHash, currentBlockData, nonce);
    const newBlock = chain.createNewBlock(nonce, previousBlockHash, blockHash);

    const requestPromises = [];
    chain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + "/receive-new-block",
            method: "POST",
            body: { newBlock: newBlock },
            json: true
        };

        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises)
        .then(data => {
            const requestOptions = {
                uri: chain.currentNodeUrl + "/transaction/broadcast",
                method: "POST",
                body: {
                    amount: 322,
                    sender: "00",
                    recepient: nodeAddress
                },
                json: true
            };

            return rp(requestOptions);
        })
        .then(data => {
            res.json({
                note: "New block mined successfully",
                block: newBlock
            });
        });
});

// receive new block
app.post("/receive-new-block", function (req, res) {
    const newBlock = req.body.newBlock;
    const lastBlock = chain.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock["number"] + 1 === newBlock["number"];

    if (correctHash && correctIndex) {
        chain.chain.push(newBlock);
        chain.pendingTransactions = [];
        res.json({
            note: "New block received and accepted.",
            newBlock: newBlock
        });
    } else {
        res.json({
            note: "New block rejected.",
            newBlock: newBlock
        });
    }
});

//register a node and broadcast it to the network
app.post("/register-and-broadcast-node", (req, res) => {
    const newNodeUrl = req.body.newNodeUrl;
    if (chain.networkNodes.indexOf(newNodeUrl) == -1) chain.networkNodes.push(newNodeUrl);
    const regNodesPromises = [];
    chain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + "/register-node",
            method: "POST",
            body: { newNodeUrl: newNodeUrl },
            json: true
        }
        regNodesPromises.push(rp(requestOptions))
    });

    Promise.all(regNodesPromises)
        .then(data => {
            const bulkRegisterOptions = {
                url: newNodeUrl + "/register-nodes-bulk",
                method: "POST",
                body: { allNetworkNodes: [...chain.networkNodes, chain.currentNodeUrl] },
                json: true
            }

            return rp(bulkRegisterOptions);
        })
        .then(data => {
            res.json({ note: "New node registered successfully" })
        })
});

//register node to a network
app.post("/register-node", (req, res) => {
    const newNodeUrl = req.body.newNodeUrl;
    const nodeNotAlreadyPresent = chain.networkNodes.indexOf(newNodeUrl) == -1;
    const notCurrentNode = chain.currentNodeUrl != newNodeUrl;
    if (nodeNotAlreadyPresent && notCurrentNode) chain.networkNodes.push(newNodeUrl);
    res.json({ note: "New node registered" });
})

//register multiple nodes at once
app.post("/register-nodes-bulk", (req, res) => {
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = chain.networkNodes.indexOf(networkNodeUrl) == -1;
        const notCurrentNode = chain.currentNodeUrl != networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) chain.networkNodes.push(networkNodeUrl);
    })

    res.json({ note: "Bulk registration successful" });
})

//reach consensus
app.get("/consensus", (req, res) => {
    const requestPromises = [];
    chain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + "/blockchain",
            method: "GET",
            json: true
        };

        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises)
        .then(blockchains => {
            const currentChainLength = chain.chain.length;
            let maxChainLength = currentChainLength;
            let newLongestChain = null;
            let newPendingTransactions = null;

            blockchains.forEach(blockchain => {
                if (blockchain.chain.length > maxChainLength) {
                    maxChainLength = blockchain.chain.length;
                    newLongestChain = blockchain.chain;
                    newPendingTransactions = blockchain.pendingTransactions;
                };
            });


            if (!newLongestChain || (newLongestChain && !chain.chainIsValid(newLongestChain))) {
                res.json({
                    note: "Current chain has not been replaced.",
                    chain: chain.chain
                });
            }
            else {
                chain.chain = newLongestChain;
                chain.pendingTransactions = newPendingTransactions;
                res.json({
                    note: "This chain has been replaced.",
                    chain: chain.chain
                });
            }
        });
});

//get block by its hash
app.get("/block/:blockHash", (req, res) => {
    const blockHash = req.params.blockHash;
    const correctBlock = chain.getBlock(blockHash);
    res.json({
        block: correctBlock
    })
})

//get transaction by id
app.get("/transaction/:transactionId", (req, res) => {
    const transactionId = req.params.transactionId;
    const transactionData = chain.getTransaction(transactionId);
    res.json({
        transaction: transactionData.transaction,
        block: transactionData.block
    })
})

//get address info
app.get("/address/:address", (req, res) => {
    const address = req.params.address;
    const addressData = chain.getAddressData(address);
    res.json({
        addressData: addressData
    })
})


//get explorer
app.get("/block-explorer", (req, res) => {
    res.sendFile(path.resolve("./explorer/index.html")) 
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})