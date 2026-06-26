/**
 * 網站密碼設定（SHA-256 hash，唔好直接放明文密碼）
 *
 * 更改密碼：
 *   node scripts/set-auth-password.mjs 你的新密碼
 *
 * 預設密碼：Jessi2026（上線後請立即更改）
 */
window.JESSI_AUTH_CONFIG = {
  passwordHash: "17ddc2b2f91ac325b99743ddcd0a79179f166d5bf12b076a635e09ef0191c725",
  sessionDays: 30,
  appName: "Jessi Beauty Academy",
};
