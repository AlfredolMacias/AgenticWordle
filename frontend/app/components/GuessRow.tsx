export default function GuessRow({ guess}: any ){
    const getColor = (value: string) => {
        if (value === "correct") return "bg-green-500"
        if (value === "incorrect" || value === "lower" || value === "higher") return "bg-gray-400"
        return "bg-yellow-500"
    }

    return (
        <div className="flex flex-col">
            {/* Player Name */}
            
            {/* Grid */}
            <div className="grid grid-cols-6 gap-2 mt-2 flex items-center  ">
                <div className="text-sm font-semibold mb-1 ">{guess.player}</div>
                <div className={`p-3 text-center rounded text-xs text-white transition-all duration-300 ${getColor(guess.result.team)}`}> {guess.team}</div>
                <div className={`p-3 text-center rounded text-sm text-white transition-all duration-300 ${getColor(guess.result.position)}`}>{guess.position}</div>
                <div className={`p-3 text-center rounded text-sm text-white transition-all duration-300 ${getColor(guess.result.jersey)}`}> {guess.jersey}  {guess.result.jersey == "higher" ? '<' : guess.result.jersey === "lower" ? '>' : ''}</div>
                <div className={`p-3 text-center rounded text-sm text-white transition-all duration-300 ${getColor(guess.result.conference)}`}> {guess.conference}</div>
                <div className={`p-3 text-center rounded text-sm text-white transition-all duration-300 ${getColor(guess.result.division)}`}> {guess.division}</div>
            </div>
            
        </div>
    )
}