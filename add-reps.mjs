const API_KEY = "AIzaSyAtoF-UHbC5MKXf7k-cYWFNtusnL9FNzaw";

const users = [
  { email: "hassan@happyboy.com", name: "Hassan" },
  { email: "khaled@happyboy.com", name: "Khaled" },
  { email: "rania@happyboy.com", name: "Rania" },
  { email: "jana@happyboy.com", name: "Jana" },
  { email: "manny@happyboy.com", name: "Manny" }
];

const password = "happy123456";

async function createUsers() {
  for (const user of users) {
    try {
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: user.email,
          password: password,
          returnSecureToken: true
        })
      });
      const data = await response.json();
      if (data.error) {
        console.error(`Error creating ${user.email}:`, data.error.message);
      } else {
        console.log(`Created user ${user.email}`);
        
        // Now update profile to set displayName
        const updateResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            idToken: data.idToken,
            displayName: user.name,
            returnSecureToken: false
          })
        });
        const updateData = await updateResponse.json();
        if (updateData.error) {
          console.error(`Error updating display name for ${user.email}:`, updateData.error.message);
        } else {
          console.log(`Updated display name for ${user.email} to ${user.name}`);
        }
      }
    } catch (e) {
      console.error(`Failed to process ${user.email}:`, e);
    }
  }
}

createUsers();
