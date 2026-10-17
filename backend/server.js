const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

// Parse JSON bodies sent to the backend.
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Backend is running!" });
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
