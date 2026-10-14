function randomToken(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let binary = "";
  for (const value of buffer) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function newPublicId(): string {
  return randomToken(9);
}

export function newManageToken(): string {
  return randomToken(24);
}
