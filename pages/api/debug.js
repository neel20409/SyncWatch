export default async function handler(req, res) {
  const uri = process.env.MONGODB_URI || "";
  
  // Parse the URI to find issues
  let parsed = {};
  try {
    // Extract parts manually
    const withoutProtocol = uri.replace("mongodb+srv://", "");
    const atIndex = withoutProtocol.lastIndexOf("@");
    const credentials = withoutProtocol.substring(0, atIndex);
    const hostPart = withoutProtocol.substring(atIndex + 1);
    const colonIndex = credentials.indexOf(":");
    const username = credentials.substring(0, colonIndex);
    const password = credentials.substring(colonIndex + 1);
    
    parsed = {
      username,
      password_length: password.length,
      password_has_special: /[@#$%^&+=!]/.test(password),
      password_has_at: password.includes("@"),
      password_has_slash: password.includes("/"),
      host: hostPart,
      full_length: uri.length,
    };
  } catch(e) {
    parsed = { parse_error: e.message };
  }

  // Try DB connection
  let dbStatus = "not tested";
  try {
    const { default: dbConnect } = await import("../../lib/db");
    await dbConnect();
    dbStatus = "connected ✅";
  } catch (err) {
    dbStatus = `failed ❌: ${err.message}`;
  }

  return res.status(200).json({
    uri_analysis: parsed,
    database: dbStatus,
  });
}
