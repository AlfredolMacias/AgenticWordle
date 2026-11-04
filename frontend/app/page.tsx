import Link from "next/link";

export default function Home(){
  return (
    <main className="flex itmes-center justify-center min-h-screen bg-gray-800 p-10">
      <div className="w-full max-w-4xl bg-white p-40 rounded-2xl shadow text-center justify-center">

        <h1 className="text-3xl font-bold mb-6 p-5">
          NFL Wordle
        </h1>

        <Link href="/game">
          {/*<button className="bg-blue-500 text-white px-4 py-2 rounded hover:btn-outline-info">Jugar</button>*/}
         <button className="relative px-16 py-4 text-white text-xl font-bold uppercase tracking-widest rounded-full transition-all duration-300 ease-in-out bg-gradient-to-r from-blue-600 via-indigo-700 to-pink-600 hover:bg-gradient-to-l hover:from-pink-600 hover:via-indigo-700 hover:to-blue-600 shadow-lg hover:shadow-2xl transform hover:-translate-y-2 hover:scale-105 active:scale-95 focus:outline-none">
            <span className="relative inline-block glitch-text">
              <span
                className="absolute top-0 left-0 w-full h-full text-pink-500 opacity-90 transform translate-x-1 -translate-y-1 blur-sm transition-all duration-200 ease-in-out hover:-translate-x-2 hover:-translate-y-2">
                Start Game
              </span>
              <span
                className="absolute top-0 left-0 w-full h-full text-blue-500 opacity-90 transform -translate-x-1 translate-y-1 blur-sm transition-all duration-200 ease-in-out hover:translate-x-2 hover:translate-y-2"
              >
                Start Game
              </span>
              <span
                className="absolute top-0 left-0 w-full h-full text-green-400 opacity-70 transform -translate-x-0.5 -translate-y-0.5 blur-xs transition-all duration-200 ease-in-out hover:translate-x-1 hover:translate-y-1"
              >
                Start Game
              </span>
              <span className="relative z-10">Start Game</span>
            </span>

            <span
              className="absolute top-0 left-0 w-full h-full rounded-full bg-gradient-radial from-blue-300/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-700"
            ></span>

            <span
              className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600 via-indigo-700 to-pink-600 opacity-50 blur-xl"
            ></span>
          </button>        
  </Link>

        </div>
    </main>

  )
}