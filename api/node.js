const express = require("express");
const bodyParser = require("body-parser");
const Blockchain = require("../chain/blockchain")
const { v4: uuidv4 } = require('uuid');
const chain = new Blockchain();
const port = process.argv[2];
const rp = require("request-promise");
const req = require("express/lib/request");
const res = require("express/lib/response");
const app = express();

const nodeAddress = uuidv4().split("-").join("")

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.get("/blockchain", (req, res) => {
    res.send(chain)
})

app.post("/transaction", (req, res) => {
    const blockIndex = chain.createNewTransaction(
        req.body.amount,
        req.body.sender,
        req.body.recepient);
    res.json({ note: `Transaction will be added to the block ${blockIndex}` });

})

app.get("/mine", (req, res) => {
    const lastBlock = chain.getLastBlock();
    const previousBlockHash = lastBlock["hash"]
    const currentBlockData = {
        transactions: chain.pendingTransactions,
        number: lastBlock["number"] + 1
    }

    const nonce = chain.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = chain.hashBlock(previousBlockHash, currentBlockData, nonce);

    chain.createNewTransaction(322, "00", nodeAddress)

    const newBlock = chain.createNewBlock(nonce, previousBlockHash, blockHash);
    res.json({
        note: "New block mined successfully",
        block: newBlock
    })
})

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

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})