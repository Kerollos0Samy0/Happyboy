const API_KEY = "AIzaSyAtoF-UHbC5MKXf7k-cYWFNtusnL9FNzaw";

const users = [
  { email: "accounting@happyboy.com", name: "Accounting" },
  { email: "ref3at@happyboy.com", name: "Ref3at" },
  { email: "omnia@happyboy.com", name: "Omnia" },
  { email: "radwa@happyboy.com", name: "Radwa" },
  { email: "eslam@happyboy.com", name: "Eslam" },
  { email: "marina@happyboy.com", name: "Marina" },
  { email: "ayat@happyboy.com", name: "Ayat" },
  { email: "kerollos@happyboy.com", name: "Kerollos" },
  { email: "youssef@happyboy.com", name: "Youssef" }
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
