// Get /campaign/join to join a Campaign

const User = require('../../../models/user/User');

module.exports = (req, res) => {
  User.joinCampaign(req.query.id, req.session.user._id, (err, submition_id) => {
    if (err) return res.redirect('/campaigns');

    return res.redirect('/test?id=' + submition_id);
  });
}
