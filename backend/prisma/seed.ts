import "dotenv/config";
import { prisma } from '../src/lib/prisma';
import axios from 'axios';

async function main(){
    console.log(process.env.DATABASE_URL);
   
    await prisma.team.upsert({ where: { name: 'Pittsburgh Steelers'}, update: { name: 'Pittsburgh Steelers'}, create: {name: 'Pittsburgh Steelers', conference: 'AFC', division: 'NORTH', abr: 'PIT'},});
    await prisma.team.upsert({ where: { name: 'Cincinnati Bengals'}, update: { name: 'Cincinnati Bengals'}, create: {name: 'Cincinnati Bengals', conference: 'AFC', division: 'NORTH', abr: 'CIN'},});
    await prisma.team.upsert({ where: { name: 'Baltimore Ravens'}, update: { name: 'Baltimore Ravens'}, create: {name: 'Baltimore Ravens', conference: 'AFC', division: 'NORTH', abr: 'BAL'},});
    await prisma.team.upsert({ where: { name: 'Cleveland Browns'}, update: { name: 'Cleveland Browns'}, create: {name: 'Cleveland Browns', conference: 'AFC', division: 'NORTH', abr: 'CLE'},});
    await prisma.team.upsert({ where: { name: 'New York Jets'}, update: { name: 'New York Jets'}, create: {name: 'New York Jets', conference: 'AFC', division: 'EAST', abr: 'NYJ'},});
    await prisma.team.upsert({ where: { name: 'Buffalo Bills'}, update: { name: 'Buffalo Bills'}, create: {name: 'Buffalo Bills', conference: 'AFC', division: 'EAST', abr: 'BUF'},});
    await prisma.team.upsert({ where: { name: 'Miami Dolphins'}, update: { name: 'Miami Dolphins'}, create: {name: 'Miami Dolphins', conference: 'AFC', division: 'EAST', abr: 'MIA'},});
    await prisma.team.upsert({ where: { name: 'New England Patriots'}, update: { name: 'New England Patriots'}, create: {name: 'New England Patriots', conference: 'AFC', division: 'EAST', abr: 'NE'},});
    await prisma.team.upsert({ where: { name: 'Jacksonville Jaguars'}, update: { name: 'Jacksonville Jaguars'}, create: {name: 'Jacksonville Jaguars', conference: 'AFC', division: 'SOUTH', abr: 'JAX'},});
    await prisma.team.upsert({ where: { name: 'Houston Texans'}, update: { name: 'Houston Texans'}, create: {name: 'Houston Texans', conference: 'AFC', division: 'SOUTH', abr: 'HOU'},});
    await prisma.team.upsert({ where: { name: 'Indianapolis Colts'}, update: { name: 'Indianapolis Colts'}, create: {name: 'Indianapolis Colts', conference: 'AFC', division: 'SOUTH', abr: 'IND'},});
    await prisma.team.upsert({ where: { name: 'Tennessee Titans'}, update: { name: 'Tennessee Titans'}, create: {name: 'Tennessee Titans', conference: 'AFC', division: 'SOUTH', abr: 'TEN'},});
    await prisma.team.upsert({ where: { name: 'Denver Broncos'}, update: { name: 'Denver Broncos'}, create: {name: 'Denver Broncos', conference: 'AFC', division: 'WEST', abr: 'DEN'},});
    await prisma.team.upsert({ where: { name: 'Kansas City Chiefs'}, update: { name: 'Kansas City Chiefs'}, create: {name: 'Kansas City Chiefs', conference: 'AFC', division: 'WEST', abr: 'KC'},});
    await prisma.team.upsert({ where: { name: 'Las Vegas Raiders'}, update: { name: 'Las Vegas Raiders'}, create: {name: 'Las Vegas Raiders', conference: 'AFC', division: 'WEST', abr: 'LV'},});
    await prisma.team.upsert({ where: { name: 'Los Angeles Chargers'}, update: { name: 'Los Angeles Chargers'}, create: {name: 'Los Angeles Chargers', conference: 'AFC', division: 'WEST', abr: 'LAC'},});
    await prisma.team.upsert({ where: { name: 'Green Bay Packers'}, update: { name: 'Green Bay Packers'}, create: {name: 'Green Bay Packers', conference: 'NFC', division: 'NORTH', abr: 'GB'},});
    await prisma.team.upsert({ where: { name: 'Chicago Bears'}, update: { name: 'Chicago Bears'}, create: {name: 'Chicago Bears', conference: 'NFC', division: 'NORTH', abr: 'CHI'},});
    await prisma.team.upsert({ where: { name: 'Minnesota Vikings'}, update: { name: 'Minnesota Vikings'}, create: {name: 'Minnesota Vikings', conference: 'NFC', division: 'NORTH', abr: 'MIN'},});
    await prisma.team.upsert({ where: { name: 'Detroit Lions'}, update: { name: 'Detroit Lions'}, create: {name: 'Detroit Lions', conference: 'NFC', division: 'NORTH', abr: 'DET'},});
    await prisma.team.upsert({ where: { name: 'Dallas Cowboys'}, update: { name: 'Dallas Cowboys'}, create: {name: 'Dallas Cowboys', conference: 'NFC', division: 'EAST', abr: 'DAL'},});
    await prisma.team.upsert({ where: { name: 'New York Giants'}, update: { name: 'New York Giants'}, create: {name: 'New York Giants', conference: 'NFC', division: 'EAST', abr: 'NYG'},});
    await prisma.team.upsert({ where: { name: 'Washington Commanders'}, update: { name: 'Washington Commanders'}, create: {name: 'Washington Commanders', conference: 'NFC', division: 'EAST', abr: 'WAS'},});
    await prisma.team.upsert({ where: { name: 'Philadelphia Eagles'}, update: { name: 'Philadelphia Eagles'}, create: {name: 'Philadelphia Eagles', conference: 'NFC', division: 'EAST', abr: 'PHI'},});
    await prisma.team.upsert({ where: { name: 'Carolina Panthers'}, update: { name: 'Carolina Panthers'}, create: {name: 'Carolina Panthers', conference: 'NFC', division: 'SOUTH', abr: 'CAR'},});
    await prisma.team.upsert({ where: { name: 'Tampa Bay Buccaneers'}, update: { name: 'Tampa Bay Buccaneers'}, create: {name: 'Tampa Bay Buccaneers', conference: 'NFC', division: 'SOUTH', abr: 'TB'},});
    await prisma.team.upsert({ where: { name: 'New Orleans Saints'}, update: { name: 'New Orleans Saints'}, create: {name: 'New Orleans Saints', conference: 'NFC', division: 'SOUTH', abr: 'NO'},});
    await prisma.team.upsert({ where: { name: 'Atlanta Falcons'}, update: { name: 'Atlanta Falcons'}, create: {name: 'Atlanta Falcons', conference: 'NFC', division: 'SOUTH', abr: 'ATL'},});
    await prisma.team.upsert({ where: { name: 'Arizona Cardinals'}, update: { name: 'Arizona Cardinals'}, create: {name: 'Arizona Cardinals', conference: 'NFC', division: 'WEST', abr: 'ARI'},});
    await prisma.team.upsert({ where: { name: 'San Francisco 49ers'}, update: { name: 'San Francisco 49ers'}, create: {name: 'San Francisco 49ers', conference: 'NFC', division: 'WEST', abr: 'SF'},});
    await prisma.team.upsert({ where: { name: 'Los Angeles Rams'}, update: { name: 'Los Angeles Rams'}, create: {name: 'Los Angeles Rams', conference: 'NFC', division: 'WEST', abr: 'LAR'},});
    await prisma.team.upsert({ where: { name: 'Seattle Seahawks'}, update: { name: 'Seattle Seahawks'}, create: {name: 'Seattle Seahawks', conference: 'NFC', division: 'WEST', abr: 'SEA'},});
    await prisma.team.upsert({ where: { name: 'Undefined'}, update: { name: 'Undefined'}, create: {name: 'Undefined', conference: 'xxx', division: 'xxx', abr: 'UND'},});
    
    
    const teams = await prisma.team.findMany();
    
    const teamMap = {};
    
    teams.forEach(t => {
        teamMap[t.abr] = t.id;
    });
    
    
    const response = await axios("https://api.sleeper.app/v1/players/nfl");
    const playersObject = response.data;
    let players = Object.values(playersObject);
    console.log(players.length)
    players = players.filter((p: any) => p.team);
    console.log(players.length)
    players = players.filter((p:any) => p.position !== "DEF");
    console.log(players.length)

    
    await prisma.player.createMany({
        data: players.map((p:any) => ({
            name: `${p.first_name} ${p.last_name}`,
            position: p.position ?? "",
            jerseyNumber: p.number ?? 0,
            yearsActive: p.years_exp ?? 0,
            age: p.age ?? 0,
            teamId: teamMap[p.team] ?? 33
        })),
    skipDuplicates: true
    });
}



main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.log(e);
        prisma.$disconnect();
        process.exit(1);
    });

