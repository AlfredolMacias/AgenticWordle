"use client"

import { useState, useMemo, useEffect, useRef } from "react";
import debounce from "lodash.debounce";

export default function PlayerInput( {onGuess, disabled}: any){
    const[query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([])
    const[selectedIndex, setSelectedIndex] = useState(-1)
    const itemRefs = useRef<(HTMLDivElement | null)[]>([])

    useEffect(() => {
        if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
            itemRefs.current[selectedIndex]?.scrollIntoView({
            block: "nearest"
            })
        }
        }, [selectedIndex])

    const debouncedSearch = useMemo( () => debounce(async (value:string) =>{
        if (value.length < 2){
            setResults([])
            return
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/players/search?q=${value}`);
        const data = await res.json();

        setResults(data)
        setSelectedIndex(-1)
    },300),
    [])

    const handleChange = (value: string) => {
        setQuery(value)
        debouncedSearch(value)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if(e.key === "ArrowDown"){
            e.preventDefault()
            setSelectedIndex((prev) => prev < results.length -1 ? prev + 1 : prev)
        }

        if(e.key === "ArrowUp"){
            e.preventDefault()
            setSelectedIndex((prev) => prev > 0 ? prev - 1 : prev)
        }

        if(e.key === "Enter"){
            e.preventDefault()
            if(selectedIndex >= 0 && results[selectedIndex]){
                const player = results[selectedIndex]
                onGuess(player.id)
                setQuery("")
                setResults([])
                setSelectedIndex(-1)
            }
        }
    }

    const handleClick = (player: any) =>{
        onGuess(player.id)
        setQuery("")
        setResults([])
        setSelectedIndex(-1)
    }

    const handleSearch = async( value: string) => { 
        setQuery(value)

        if(value.length < 2){
            setResults([]);
            return;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/players/search?q=${value}`);

        const data = await res.json();
        setResults(data);
    }
    return (
        <div className="mb-4">
        <input type="text" disabled={disabled} placeholder="Search a player..." value={query} onChange={(e) => handleChange(e.target.value)} onKeyDown={handleKeyDown} className="border rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus: ring-blue-500"/>
        {results.length > 0 && (
                <div className="bg-white border rounded-lg w-full mt-1 shadow max-h-48 overflow-y-auto z-10">
                {results.map((player, index) => (
                    <div
                    key={player.id}
                    ref={(el) => {itemRefs.current[index] = el}}
                    className={`p-3 cursor-pointer flex justify-between ${index === selectedIndex ? "bg-blue-500 text-white" : "hover:bg-gray-100"}`}
                    onClick={() => handleClick(player)}
                    >
                    <span>{player.name}</span> - <span className="text-sm opacity-70">{player.position} - {player.team.name}</span>
                    </div>
                ))}

                </div>
            )}
            </div>
    )
}