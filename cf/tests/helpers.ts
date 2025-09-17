export async function generateApiKey(secret: string) {
  const enc = new TextEncoder();
  const data = enc.encode(secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `om_${hashHex.substring(0, 32)}`;
}
