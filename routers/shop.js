const router = require("express").Router();

router.use((req, res, next) => {
  if (req.user) {
    next();
  } else {
    res.send("마이페이지 볼려면 로그인을 해라");
    console.log(req.user);
  }
});

router.get("/shirts", (req, res) => {
  res.send("셔츠 페이지");
});

router.get("/pants", (req, res) => {
  res.send("바지 페이지");
});

module.exports = router;
