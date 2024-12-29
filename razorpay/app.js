const Razorpay=require('razorpay');
const express=require('express');
const bodyParser=require('body-parser');
const fs=require('fs');
const path=require('path');
const { validateWebhookSignature } = require('razorpay/dist/utils/razorpay-utils');


//creating an app
const app=express();
const port=3000||process.env.PORT;

//setting up body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

//serve static sites
app.use(express.static(path.join(__dirname)));


//setting up razorpay credentials
const razorpay=new Razorpay({
    key_id:'',
    key_secret:''
});

//setting up read functions 
const readData=()=>{
    if(fs.existsSync('orders.json')){
        const data=fs.readFileSync('orders.json');
        return JSON.parse(data);
    }
    else{
        return [];
    }
};

//function for writing content into the orders.json file
const writeData=(data)=>{
   fs.writeFileSync('orders.json',JSON.stringify(data,null,2));
}

//if there is no file, we create an empty one
if(!fs.existsSync('orders.json')){
    writeData([]);
}

//create Post API for creating an order
app.post('/createOrder',async(req,res)=>{
    try{
        const {amount,currency,receipt,notes}=req.body;
        const options={
            amount:amount*100,
            currency,
            receipt,
            notes  
        };
        const order=await razorpay.orders.create(options);
        const orders=readData();
        orders.push(
            {
                id:order.id,
                amount:order.amount,
                currency:order.currency,
                receipt:order.receipt,
                notes:order.notes,
                status:order.status
            }
        );
        writeData(orders);
        //send data to frontend
        res.json(order);

    }
    catch(error){
        console.log(error);
        res.status(500).send("Error creating an order for the user");
    }
})


//route for the success page 
app.get('/success',(req,res)=>{
    res.sendFile(path.join(__dirname,'success.html'));
});


//setting up an API to fetch the verification of the order via razorpay's signature verification
app.get('/verify-payment',(req,res)=>{
    const{razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body;
    const secret=razorpay.key_secret;
    const body=razorpay_order_id+'|'+razorpay_payment_id;

    try{
        const validateSignature=validateWebhookSignature(body,razorpay_signature,secret);
        if(validateSignature){
            //update the order status
            const orders=readData();
            const order=find(o=>o.order_id==razorpay_order_id);
            if(order){
                order.status='paid';
                order.payment_id=razorpay_payment_id;
                writeData(orders);
                res.status(200).json({message:'Payment verified successfully'});
            }
            else{
                res.status(404).json({message:'Order not found'});
            }

        }
        else{
            res.status(400).send("Invalid Signature");
        }
    }
    catch(error){
        console.log(error);
        res.status(500).send("Error verifying the payment");
    }
});


app.listen(port,()=>{
    console.log(`We are live with the server at ${port}`);
})


