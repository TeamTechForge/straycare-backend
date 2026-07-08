async function test() {
  try {
    const res = await fetch("http://127.0.0.1:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doesnotexist@example.com", password: "somepassword" })
    });
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Response:", json);
  } catch (err) {
    console.error("Error during fetch:", err);
  }
}
test();
