"use client"

import { useEffect, useState } from "react";
import PlayerInput from "../components/PlayerInput";
import GuessRow from "../components/GuessRow";

export default function GamePage(){

    const [gameId, setGameId] = useState<number | null>(null)
    const [guesses, setGuesses] = useState<any[]> ([])

     useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/game/start`, {
      method: "POST"
    })
      .then(res => res.json())
      .then(data => setGameId(data.id))
  }, [])

    const handleGuess = async ( playerId: number ) =>{
        console.log(gameId);
        if(!gameId) return
        const res = await  fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/game/${gameId}/guess`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ playerId })
        })
        const data = await res.json();
        console.log(data);
        setGuesses(prev => [...prev, data])
    }
    const error = guesses.findLast(g => g.error);
    if(error){
        return (<></>)
    }
    const isGameWon = guesses.some(g => g.isWinner);
    const isFinished = guesses.findLast(g => g.isFinished);
    return (
        <div className="min-h-screen bg-gray-200 flex flex-col items-center p-6">
            <h1 className="text-3xl font-bold mb-6">Find the Player 🏈</h1>
            <div className="w-full max-w-4xl bg-white p-6 rounded-2xl shadow">
                <PlayerInput onGuess={handleGuess} disabled={isFinished}/>
                <div className="grid grid-cols-6 gap-2 mt-6 text-sm font-bold text-gray-600 mb-10">
                    <div className="text-center">Player</div>
                    <div className="text-center">Team</div>
                    <div className="text-center">Position</div>
                    <div className="text-center">Jersey</div>
                    <div className="text-center">Conference</div>
                    <div className="text-center">Division</div>
                </div>
                {guesses.map((g, i) => (
                    <GuessRow key= {i} guess={g}/>
                ))}

                {isGameWon &&(
                    <div className="mt-4 p-4 bg-green-100 text-green-800 rounded text-center font-semibold">
                        🎉 Correct! You found the player!
                    </div>
                )}
                
                {isFinished && !isGameWon &&(
                    <div className="mt-4 p-4 bg-red-100 text-red-800 rounded text-center font-semibold">
                        You Lost! <br/>
                        <span className="text-sm text-opacity-70">Correct: {isFinished.secretPlayer}</span>
                    </div>
                )}
                <div className="text-sm text-gray-500 mt-4 text-center" >
                    Attempts: {guesses.length} / 6
                </div>
                
            </div>
            <button onClick={() => window.location.reload()}
                  className="mt-7 p-3 bg-gray-800 text-white rounded-2xl place-self-center hover:bg-gray-500 ">New Game</button>
        </div>

    )
}
