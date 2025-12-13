// const validator=require("validator");

// const validateSignUpData=(req)=>{
//     const {firstName,lastName,email,password}=req.body;

//     if (!firstName || !lastName)
//     {
//         throw new Error("First name and last name are required");
//     }
//     else if (!validator.isEmail(email))
//     {
//         throw new Error("Email is not valid!");
//     }
//     else if (!validator.isStrongPassword(password))
//     {
//         throw new Error("Password is not strong enough!");
//     }
// }

// module.exports={validateSignUpData};

const validator = require("validator");

/**
 * 🧪 Validates user signup data
 * - Throws error if validation fails
 * - Keeps controllers clean & readable
 */
const validateSignUpData = (req) => {
  const { firstName, lastName, email, password } = req.body;

  // 🚫 First name is mandatory for profile identity
  if (!firstName || firstName.trim().length < 2) {
    throw new Error("First name must be at least 2 characters long");
  }

  // ℹ️ Last name is optional but should be valid if provided
  if (lastName && lastName.trim().length < 2) {
    throw new Error("Last name must be at least 2 characters long");
  }

  // 📧 Validate email format
  if (!email || !validator.isEmail(email)) {
    throw new Error("Please provide a valid email address");
  }

  /**
   * 🔐 Password strength rules (validator default):
   * - Min 8 characters
   * - At least 1 lowercase
   * - At least 1 uppercase
   * - At least 1 number
   * - At least 1 symbol
   */
  if (!password || !validator.isStrongPassword(password)) {
    throw new Error(
      "Password must be at least 8 characters long and include uppercase, lowercase, number, and symbol"
    );
  }

  // ✅ Validation passed
  return true;
};

module.exports = { validateSignUpData };
