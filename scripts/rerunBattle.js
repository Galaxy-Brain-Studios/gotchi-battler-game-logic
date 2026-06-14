const fs = require('fs')
const path = require('path')

const {
    battle,
    createBattleInputFromLog
} = require('..')

const usage = `
Usage:
  node scripts/rerunBattle.js <log-file> [--n <count>] [--out <file>] [--include-logs]

Examples:
  node scripts/rerunBattle.js scripts/data/honing_edge.json
  node scripts/rerunBattle.js scripts/data/honing_edge.json --n 100
  node scripts/rerunBattle.js scripts/data/honing_edge.json --n 100 --out scripts/output/honing-edge-rerun.json

Modes compared:
  prepared  Uses the old log.gotchis battle-start stats as-is.
  rebased   Removes setup.statAdjustments, then reruns setup with current constants.
`

const parseArgs = (argv) => {
    const args = {
        logPath: null,
        n: 1,
        out: null,
        includeLogs: false,
        preserveStartingState: undefined,
        allowLegacyBestEffort: false
    }

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]

        if (arg === '--help' || arg === '-h') {
            args.help = true
            continue
        }

        if (arg === '--n' || arg === '-n') {
            args.n = Number(argv[++i])
            continue
        }

        if (arg === '--out' || arg === '-o') {
            args.out = argv[++i]
            continue
        }

        if (arg === '--include-logs') {
            args.includeLogs = true
            continue
        }

        if (arg === '--preserve-starting-state') {
            args.preserveStartingState = true
            continue
        }

        if (arg === '--legacy-best-effort') {
            args.allowLegacyBestEffort = true
            continue
        }

        if (!args.logPath) {
            args.logPath = arg
            continue
        }

        throw new Error(`Unknown argument: ${arg}`)
    }

    if (!args.logPath) {
        args.logPath = path.join(__dirname, 'data', 'honing_edge.json')
    }

    if (!Number.isInteger(args.n) || args.n < 1) {
        throw new Error('--n must be a positive integer')
    }

    if (args.includeLogs && args.n !== 1) {
        throw new Error('--include-logs can only be used with --n 1')
    }

    return args
}

const readJson = (filePath) => {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

const getDefaultOutputPath = (logPath) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const name = path.basename(logPath, path.extname(logPath))
    return path.join(__dirname, 'output', `${name}-rerun-${stamp}.json`)
}

const printModeSummary = (label, mode) => {
    if (!mode.available) {
        console.log(`${label}: unavailable (${mode.error})`)
        return
    }

    console.log(`${label}: team1 ${mode.team1WinRate}% (${mode.team1Wins}), team2 ${mode.team2WinRate}% (${mode.team2Wins})`)
}

const getLogSeed = (log) => {
    return log?.meta?.seed || 'randomseed'
}

const rerunBattleFromLog = (log, options = {}) => {
    const input = createBattleInputFromLog(log, options)

    return {
        input,
        logs: battle(input.team1, input.team2, input.seed, input.options)
    }
}

const getSampleSeed = (baseSeed, index, count) => {
    if (count === 1) return baseSeed
    return `${baseSeed}:rerun:${index + 1}`
}

const createWinRateBucket = () => ({
    available: true,
    team1Wins: 0,
    team2Wins: 0,
    team1WinRate: 0,
    team2WinRate: 0
})

const finalizeWinRates = (bucket, n) => {
    if (!bucket.available) return bucket

    bucket.team1WinRate = Math.round((bucket.team1Wins / n) * 10000) / 100
    bucket.team2WinRate = Math.round((bucket.team2Wins / n) * 10000) / 100
    return bucket
}

const compareBattleWinRatesFromLog = (log, options = {}) => {
    const n = Number.isInteger(options.n) && options.n > 0 ? options.n : 1
    const baseSeed = options.seed || getLogSeed(log)
    const modes = {
        prepared: createWinRateBucket(),
        rebased: createWinRateBucket()
    }
    const runs = []
    const warnings = []

    for (let i = 0; i < n; i++) {
        const seed = getSampleSeed(baseSeed, i, n)
        const run = { seed }

        Object.keys(modes).forEach((mode) => {
            const bucket = modes[mode]
            if (!bucket.available) return

            try {
                const result = rerunBattleFromLog(log, {
                    ...options,
                    mode,
                    seed
                })

                const winner = result.logs.result.winner
                if (winner === 1) bucket.team1Wins++
                if (winner === 2) bucket.team2Wins++

                run[mode] = { winner }
                result.input.warnings.forEach((warning) => {
                    if (!warnings.includes(warning)) warnings.push(warning)
                })
            } catch (error) {
                bucket.available = false
                bucket.error = error.message
                run[mode] = { error: error.message }
            }
        })

        if (options.includeRuns) runs.push(run)
    }

    finalizeWinRates(modes.prepared, n)
    finalizeWinRates(modes.rebased, n)

    return {
        n,
        seed: baseSeed,
        modes,
        warnings,
        ...(options.includeRuns ? { runs } : {})
    }
}

const main = async () => {
    const args = parseArgs(process.argv.slice(2))
    if (args.help) {
        console.log(usage.trim())
        return
    }

    console.time('Rerun battle')

    const logPath = path.resolve(process.cwd(), args.logPath)
    const log = readJson(logPath)
    const summary = compareBattleWinRatesFromLog(log, {
        n: args.n,
        includeRuns: true,
        preserveStartingState: args.preserveStartingState,
        allowLegacyBestEffort: args.allowLegacyBestEffort
    })

    const output = {
        source: logPath,
        generatedAt: new Date().toISOString(),
        ...summary
    }

    if (args.includeLogs) {
        output.logs = {}
        output.logs.prepared = rerunBattleFromLog(log, { mode: 'prepared' }).logs

        if (summary.modes.rebased.available) {
            output.logs.rebased = rerunBattleFromLog(log, {
                mode: 'rebased',
                preserveStartingState: args.preserveStartingState,
                allowLegacyBestEffort: args.allowLegacyBestEffort
            }).logs
        }
    }

    const outPath = path.resolve(process.cwd(), args.out || getDefaultOutputPath(logPath))
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(output, null, 4))

    console.log(`Source: ${logPath}`)
    console.log(`Runs: ${summary.n}`)
    printModeSummary('Prepared old log', summary.modes.prepared)
    printModeSummary('Rebased current constants', summary.modes.rebased)

    if (summary.warnings.length) {
        console.log('Warnings:')
        summary.warnings.forEach(warning => console.log(`- ${warning}`))
    }

    console.log(`Output: ${outPath}`)
    console.timeEnd('Rerun battle')
}

// node scripts/rerunBattle.js scripts/data/honing_edge.json --n 100
if (require.main === module) {
    main()
        .then(() => {
            process.exit(0)
        })
        .catch((error) => {
            console.error('Error rerunning battle: ', error)
            process.exit(1)
        })
}

module.exports = {
    parseArgs,
    rerunBattleFromLog,
    compareBattleWinRatesFromLog,
    main
}
