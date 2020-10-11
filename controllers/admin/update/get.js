const async = require('async');
const mongoose = require('mongoose');

const User = require('../../../models/user/User');
const Campaign = require('../../../models/campaign/Campaign');

const sendMail = require('../../../utils/sendMail');

module.exports = (req, res) => {
  if (!req.query || !req.query.updates)
    return res.redirect('/');

  // User.find({$and: [
  //   {"information.5f74c3442b4e90001c72b747": {$ne: null}},
  //   {"information.5f74c3442b4e90001c72b747": {$ne: "Lisanslı sporcu değilim"}},
  //   {gender: "kadın"},
  //   {birth_year: {$gte: 2001}},
  //   {birth_year: {$lte: 2007}},
  // ]}, (err, users) => {
  //   if (err) return res.redirect('/');

  //   return res.json({
  //     count: users.length,
  //     users: users.map(user => {
  //       return {
  //         name: user.name,
  //         email: user.email,
  //         phone: user.phone
  //       };
  //     })
  //   });
  // });

  sendMail({
    emailList: ["ygurlek22@my.uaa.k12.tr", "ybyesilyurt@gmail.com"]
  }, 'nikeEmail', err => {
    console.log(err);

    return res.redirect('/admin');
  });
}
