export const WAREHOUSE_EMAILS = [
  "ahmed001@happyboy.com",
  "hossam001@happyboy.com"
];

// Rough coordinates (Latitude, Longitude) - Can be updated later with exact coordinates
export const BRANCH_LOCATIONS = [
  { name: "التجمع", lat: 30.0074, lng: 31.4326 },
  { name: "العبور", lat: 30.2223, lng: 31.4820 },
  { name: "عين شمس", lat: 30.1294, lng: 31.3323 },
];

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;  
  const dLon = (lon2 - lon1) * Math.PI / 180; 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

export async function detectBranch(userEmail?: string | null): Promise<string> {
  // 1. Check Email for Warehouse
  if (userEmail && WAREHOUSE_EMAILS.includes(userEmail.toLowerCase())) {
    return "المخزن";
  }

  // 2. Fallback to GPS for other branches
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve("أخرى"); // Geolocation not supported or SSR
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        let closestBranch = "أخرى";
        let minDistance = Infinity;

        for (const branch of BRANCH_LOCATIONS) {
          const distance = calculateDistance(latitude, longitude, branch.lat, branch.lng);
          if (distance < minDistance) {
            minDistance = distance;
            closestBranch = branch.name;
          }
        }

        // Only assign if it's within a reasonable distance (e.g., 20km)
        if (minDistance <= 20) {
          resolve(closestBranch);
        } else {
          resolve("أخرى");
        }
      },
      (error) => {
        console.warn("Geolocation error:", error);
        resolve("أخرى");
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });
}
