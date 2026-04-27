const express = require('express');
const router = express.Router();
const strayController = require('../controllers/strayController');

router.post('/report', strayController.reportStray);
router.get('/map', strayController.getStrayLocations);

module.exports = router;