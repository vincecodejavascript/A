const express = require('express');
const ejs = require('ejs');
const paypal = require('paypal-rest-sdk');
const app = express();
var nodemailer = require('nodemailer');

// Start door terminal = 'node app.js'

// ==> Verbind Met MongoDB 
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

// ==> Verbind met nodemailer + Inloggevens van zender
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: '',
      pass: ''
    }
  });

// ==> CSS Bestand koppelen
app.use(express.static(__dirname + '/public'));

app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);

app.set('view engine', 'ejs');

app.get('/', function(req,res) {
    res.render('index.html')
})

app.get('/cart', function(req,res) {
    res.render('cart.html')
})

app.get('/order', function(req,res) {
    res.render('order.html')
})

app.use(express.urlencoded({
    extended: true
}))    

// ==> Sandbox Paypal, en client id/secret
paypal.configure({
    'mode': 'sandbox', //sandbox or live
    'client_id': 'AZhpAlKpRZ0NVHWQmTKRLrfa_imIX7inr3VvX8kDgBJuI7uvnWDqXqlXgqqR5N--hm2DDPtIZs-gHPax',
    'client_secret': 'EPbhoeLGql4jK3ySasofM9dcRmGZ3rgCrkndO7mHn_oR6ZjVoPdXYOxZFcdq1MrDrxvG58mBCPSpPUVa'
});

// ==> Order informatie wordt doorgestuurd naar mongoDB

app.post('/pay', (req, res) => {
    email = req.body.email;
    name = req.body.firstname, 
    MongoClient.connect(url, function(err, db, payment) {
        var dbo = db.db("mydb");
        const order = {
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
        country: req.body.country,
        postalcode: req.body.postalcode,
        adress: req.body.adress,
        phonenumber: req.body.phone,
    }
        dbo.collection("customers").insertOne(order, function(err, res) {
          console.log("1 document inserted");
          db.close();
        });
      });
    
    // ==> Paypal betaling aanmaken

    const create_payment_json = {
        "intent": "sale",
        "payer": {
            "payment_method": "paypal"
        },
        "redirect_urls": {
            "return_url": "http://localhost:3000/succes",
            "cancel_url": "http://localhost:3000/cancel"
        },
        "transactions": [{
            "item_list": {
                "items": [{
                    "name": "9D BLUETOOTH BOX",
                    "sku": "001",
                    "price": "29.95",
                    "currency": "USD",
                    "quantity": 1
                }]
            },
            "amount": {
                "currency": "USD",
                "total": "29.95"
            },
            "description": "|9D BLUETOOTH BOX"
        }]
    };
    
    paypal.payment.create(create_payment_json, function (error, payment) {
        if (error) {
            throw error;
        } else {
            for(let i = 0; i < payment.links.length; i++){
                if(payment.links[i].rel === "approval_url") {
                    res.redirect(payment.links[i].href);
                }
            }
        }
    });
});

app.get('/succes', (req, res, next) => {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;

    const execute_payment_json = {
        "payer_id": payerId,
        "transactions": [{
            "amount": {
                "currency": "USD",
                "total": "29.95",
            }
        }]
    };
    paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
        if (error) {
            console.log(error);
            throw error;
        } else {
            res.render('succes.html');
            // ==> Slaat order informatie op
            MongoClient.connect(url, function(err, db) {
                var dbo = db.db("mydb");
                var myobj = { ORDER: JSON.stringify(payment)};
                dbo.collection("customers").insertOne(myobj, function(err, res) {
                  console.log("1 document inserted");
                  db.close();
                });
              });
              // ==> Verstuur een email na betaling
              var mailOptions = {
                from: '',
                to: email,
                subject: 'Order Confirmation ' + paymentId,
                text: "Hello "+ name +",\n\n Thank you for ordering! \n"+'\nOrder ' + paymentId + '\n The order will be shipped very soon!\n\n You will recieve tracking information as soon as the product is shipped. \nFor Questions you CAN email email@gmail.com!\n Best Regards, \n\n COMPANY NAME'
              };
              
              transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                  console.log(error);
                } else {
                  console.log('Email sent: ' + info.response);
                }
              });
            }
    });
});

app.get('/cancel', (req, res) => res.render('cancel.html'));

app.listen(3000, () => console.log('Server Started at localhost:3000'));