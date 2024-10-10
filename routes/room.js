const express = require("express");
const router = express.Router();

router.get("*", (req, res) => {
  if (req.path !== "/") {
    res.redirect("/");
  } else {
    res.render("index", {title: "OnlineChat"});
  }
});

module.exports = router;