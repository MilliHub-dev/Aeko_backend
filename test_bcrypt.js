import bcrypt from "bcrypt";

const plainPassword = "1234567890"; // the password you are trying in Postman
const storedHash = "$2b$10$UVAlnlgNZSC0Z4Joum9o5..sdN.sGpEucI/p12/1dgqXxA2H6EDhW";

bcrypt.compare(plainPassword, storedHash)
  .then(match => {
    console.log("Password match?", match);
  })
  .catch(err => console.error("Error comparing passwords:", err));
