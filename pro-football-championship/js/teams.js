/**
 * PRO FOOTBALL CHAMPIONSHIP - TEAMS & ROSTERS
 */

const TEAMS_DATA = {
    real_madrid: {
        id: "real_madrid",
        name: "Real Madrid",
        short: "RMA",
        primaryColor: "#ffffff",
        secondaryColor: "#00529f",
        accentColor: "#febe10",
        numberColor: "#00529f",
        shortsColor: "#ffffff",
        socksColor: "#ffffff",
        rating: 92,
        players: [
            { id: 1, name: "Courtois", number: 1, role: "GK", speed: 65, shoot: 40, pass: 75, tackle: 88, gk: 94 },
            { id: 2, name: "Rudiger", number: 22, role: "DEF", speed: 84, shoot: 55, pass: 72, tackle: 91, gk: 40 },
            { id: 3, name: "Bellingham", number: 5, role: "MID", speed: 86, shoot: 88, pass: 89, tackle: 82, gk: 40 },
            { id: 4, name: "Vinicius Jr", number: 7, role: "FWD", speed: 96, shoot: 90, pass: 84, tackle: 45, gk: 35 },
            { id: 5, name: "Mbappé", number: 9, role: "FWD", speed: 97, shoot: 94, pass: 82, tackle: 42, gk: 35 }
        ]
    },
    barcelona: {
        id: "barcelona",
        name: "FC Barcelona",
        short: "BAR",
        primaryColor: "#a50044",
        secondaryColor: "#004d98",
        accentColor: "#edbb00",
        numberColor: "#edbb00",
        shortsColor: "#004d98",
        socksColor: "#a50044",
        rating: 90,
        players: [
            { id: 1, name: "Ter Stegen", number: 1, role: "GK", speed: 64, shoot: 35, pass: 82, tackle: 85, gk: 91 },
            { id: 2, name: "Araujo", number: 4, role: "DEF", speed: 85, shoot: 50, pass: 70, tackle: 90, gk: 40 },
            { id: 3, name: "Pedri", number: 8, role: "MID", speed: 82, shoot: 78, pass: 92, tackle: 75, gk: 40 },
            { id: 4, name: "Lamine Yamal", number: 19, role: "FWD", speed: 92, shoot: 86, pass: 88, tackle: 48, gk: 35 },
            { id: 5, name: "Lewandowski", number: 9, role: "FWD", speed: 78, shoot: 93, pass: 79, tackle: 45, gk: 35 }
        ]
    },
    man_city: {
        id: "man_city",
        name: "Manchester City",
        short: "MCI",
        primaryColor: "#6cabdd",
        secondaryColor: "#1c2c5b",
        accentColor: "#ffffff",
        numberColor: "#ffffff",
        shortsColor: "#ffffff",
        socksColor: "#6cabdd",
        rating: 93,
        players: [
            { id: 1, name: "Ederson", number: 31, role: "GK", speed: 68, shoot: 45, pass: 88, tackle: 84, gk: 90 },
            { id: 2, name: "Dias", number: 3, role: "DEF", speed: 79, shoot: 48, pass: 77, tackle: 92, gk: 40 },
            { id: 3, name: "De Bruyne", number: 17, role: "MID", speed: 80, shoot: 89, pass: 95, tackle: 74, gk: 40 },
            { id: 4, name: "Bernardo", number: 20, role: "MID", speed: 84, shoot: 82, pass: 90, tackle: 76, gk: 40 },
            { id: 5, name: "Haaland", number: 9, role: "FWD", speed: 92, shoot: 96, pass: 72, tackle: 46, gk: 35 }
        ]
    },
    pakhtakor: {
        id: "pakhtakor",
        name: "Paxtakor Toshkent",
        short: "PAK",
        primaryColor: "#f9d616",
        secondaryColor: "#0b3c8c",
        accentColor: "#ffffff",
        numberColor: "#0b3c8c",
        shortsColor: "#0b3c8c",
        socksColor: "#f9d616",
        rating: 84,
        players: [
            { id: 1, name: "Suyunov", number: 35, role: "GK", speed: 62, shoot: 30, pass: 70, tackle: 80, gk: 85 },
            { id: 2, name: "Alijonov", number: 34, role: "DEF", speed: 83, shoot: 60, pass: 75, tackle: 84, gk: 38 },
            { id: 3, name: "Hamrobekov", number: 27, role: "MID", speed: 79, shoot: 74, pass: 82, tackle: 83, gk: 40 },
            { id: 4, name: "Turg'unboyev", number: 8, role: "MID", speed: 85, shoot: 80, pass: 81, tackle: 68, gk: 35 },
            { id: 5, name: "Sergeev", number: 11, role: "FWD", speed: 81, shoot: 86, pass: 74, tackle: 45, gk: 35 }
        ]
    },
    nasaf: {
        id: "nasaf",
        name: "Nasaf Qarshi",
        short: "NAS",
        primaryColor: "#d91b24",
        secondaryColor: "#1a1a1a",
        accentColor: "#ffffff",
        numberColor: "#ffffff",
        shortsColor: "#1a1a1a",
        socksColor: "#d91b24",
        rating: 83,
        players: [
            { id: 1, name: "Nematov", number: 35, role: "GK", speed: 64, shoot: 32, pass: 72, tackle: 82, gk: 87 },
            { id: 2, name: "G'aybullayev", number: 5, role: "DEF", speed: 78, shoot: 52, pass: 73, tackle: 86, gk: 40 },
            { id: 3, name: "Mozgovoy", number: 7, role: "MID", speed: 81, shoot: 77, pass: 84, tackle: 80, gk: 40 },
            { id: 4, name: "Siddiqov", number: 10, role: "MID", speed: 84, shoot: 81, pass: 83, tackle: 65, gk: 35 },
            { id: 5, name: "Cruz", number: 19, role: "FWD", speed: 85, shoot: 84, pass: 75, tackle: 48, gk: 35 }
        ]
    },
    argentina: {
        id: "argentina",
        name: "Argentina",
        short: "ARG",
        primaryColor: "#75aadb",
        secondaryColor: "#ffffff",
        accentColor: "#f6b40e",
        numberColor: "#000000",
        shortsColor: "#000000",
        socksColor: "#ffffff",
        rating: 94,
        players: [
            { id: 1, name: "E. Martinez", number: 23, role: "GK", speed: 66, shoot: 38, pass: 76, tackle: 87, gk: 93 },
            { id: 2, name: "Romero", number: 13, role: "DEF", speed: 82, shoot: 52, pass: 74, tackle: 93, gk: 40 },
            { id: 3, name: "De Paul", number: 7, role: "MID", speed: 83, shoot: 79, pass: 86, tackle: 85, gk: 40 },
            { id: 4, name: "Di Maria", number: 11, role: "FWD", speed: 86, shoot: 87, pass: 89, tackle: 55, gk: 35 },
            { id: 5, name: "Messi", number: 10, role: "FWD", speed: 88, shoot: 97, pass: 96, tackle: 45, gk: 35 }
        ]
    },
    brazil: {
        id: "brazil",
        name: "Brazil",
        short: "BRA",
        primaryColor: "#fed100",
        secondaryColor: "#009b3a",
        accentColor: "#002776",
        numberColor: "#002776",
        shortsColor: "#002776",
        socksColor: "#ffffff",
        rating: 91,
        players: [
            { id: 1, name: "Alisson", number: 1, role: "GK", speed: 67, shoot: 36, pass: 80, tackle: 86, gk: 92 },
            { id: 2, name: "Marquinhos", number: 4, role: "DEF", speed: 81, shoot: 54, pass: 78, tackle: 89, gk: 40 },
            { id: 3, name: "Casemiro", number: 5, role: "MID", speed: 76, shoot: 80, pass: 82, tackle: 91, gk: 40 },
            { id: 4, name: "Rodrygo", number: 11, role: "FWD", speed: 91, shoot: 87, pass: 83, tackle: 50, gk: 35 },
            { id: 5, name: "Neymar Jr", number: 10, role: "FWD", speed: 89, shoot: 92, pass: 93, tackle: 44, gk: 35 }
        ]
    }
};

window.TEAMS_DATA = TEAMS_DATA;
