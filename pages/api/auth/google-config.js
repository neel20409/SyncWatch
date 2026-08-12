export default function handler(req, res) {
  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    "507034923185-j8uahgg0ne101djb6j0sk2unhb192rcg.apps.googleusercontent.com";

  return res.status(200).json({ clientId });
}
