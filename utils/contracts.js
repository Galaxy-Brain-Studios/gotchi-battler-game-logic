const { ethers } = require('ethers')
const tournamentAbi = require('../constants/tournamentManagerAbi.json')

const getTournamentContract = (address) => {
    const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com')
    const contract = new ethers.Contract(address, tournamentAbi, provider)

    return contract
}

module.exports = {
    getTournamentContract
}