const { app } = require("./app");
const express = require("express");
const axios = require("axios");
const router = express.Router();
const dot = require('dot-object');
const session = require("express-session");
const fs = require('fs');
const botFile = fs.readFileSync('bots.json', 'utf-8');
const footerFile = fs.readFileSync('footer.json', 'utf-8');


// Read JSON file
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_TO = process.env.WHATSAPP_TO;
const WHATSAPP_VERSION = process.env.WHATSAPP_VERSION;
const WHATSAPP_PHONEID = process.env.WHATSAPP_PHONEID;

const bots = JSON.parse(botFile);
const footer = JSON.parse(footerFile);


const sendMessage = (req, res) => {
    console.log(req.body);
    let messageObj = req.body;
    console.log('-----', req.body)
    axios
        .post(
            `https://graph.facebook.com/${WHATSAPP_VERSION}/${WHATSAPP_PHONEID}/messages`,
            messageObj,
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                },
            }
        )
        .then(function (response) {
            res.status(response.status).send(response.statusText);
        })
        .catch(function (error) {
            res.status(error.response.status).send(error.response.statusText);
        });
}

const webhook = async (req, res) => {
    let incomingMsg = req.body.entry || {};
    console.log(incomingMsg);
    let userSelection = await req?.session?.userSelection || null;
    let msg = incomingMsg && incomingMsg[0] && incomingMsg[0].changes && incomingMsg[0].changes[0].value.messages && incomingMsg[0].changes[0].value.messages[0];
    if (((!userSelection && msg?.type !== 'interactive') || msg?.interactive?.button_reply.id === 'end')) {
        let body = {
            "messaging_product": "whatsapp",
            "to": WHATSAPP_TO,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "header": {
                    "type": "text",
                    "text": "Welcome to Digital Jadui Pitara"
                },
                "body": {
                    "text": "Please select the options below"
                },
                "action": {
                    "buttons": [
                        {
                            "type": "reply",
                            "reply": {
                                "id": "1-js",
                                "title": "Interactive Bot"
                            }
                        },
                        {
                            "type": "reply",
                            "reply": {
                                "id": "2-ks",
                                "title": "Story Bot"
                            }
                        }
                    ]
                }
            }
        }

        axios.post(
            `https://graph.facebook.com/${WHATSAPP_VERSION}/${WHATSAPP_PHONEID}/messages`,
            body,
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                }
            }).then(
                (response) => {
                    console.log("webhook => Sent initial message to WhatsApp");
                    res.status(response.status).send(response.statusText);
                },
                (error) => {
                    console.log("webhook => error occured  with status code:", error.response.status);
                    res.status(error.response.status).send(error.response.statusText);
                }
            );

        await req?.session?.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                res.sendStatus(500);
            } else {
                console.log('Session cleared successfully');
            }
        })
    } else {
        console.log('USER Selection----', userSelection)

        if (!userSelection) {
            // If not present, set the default value from the incoming message
            userSelection = msg.interactive.button_reply.id;
            req.session.userSelection = userSelection;
            console.log('Value not present. Setting userSelection:', userSelection);
        } else {
            console.log('Existing userSelection:', userSelection);
        }

        let endMsg = "\n 0: Go to 'Main Menu' \n 1: 'Change Lang'";
        let botResponse = await getBotMessage(msg, userSelection);
        console.log("webhook => botResponse", botResponse?.answer.trim(100));
        let ansStr = botResponse?.answer.substring(0, 2000) + endMsg;
        console.log('-------', ansStr)
        axios({
            "method": "post",
            "url": `https://graph.facebook.com/${WHATSAPP_VERSION}/${WHATSAPP_PHONEID}/messages`,
            "data": {
                "messaging_product": "whatsapp",
                "to": WHATSAPP_TO,

                "text": {
                    "body": ansStr,
                },
                "type": 'interactive', // Move 'type' to the 'text' property
                "interactive": {
                    "type": "button",
                    "header": {
                        "type": "text",
                        "text": "DJP"
                    },
                    "body": {
                        "text": `${ansStr}`
                    },
                    "action": {
                        "buttons": [
                            {
                                "type": "reply",
                                "reply": {
                                    "id": "end",
                                    "title": "Start Again"
                                }
                            }
                        ]
                    }
                },
            },
            headers: {
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json"
            },
        })
            .then(
                (response) => {
                    console.log("webhook => Sent message to WhatsApp");
                    res.status(response.status).send(response.statusText);
                },
                (error) => {
                    console.log("webhook => error occured  with status code:", error.response.status);
                    console.log("webhook => error:");
                    res.status(error.response.status).send(error.response.statusText);
                }
            );
    }
}

const getBotMessage = async (msg, userSelection) => {
    if (msg) {
        let userQuery = msg.text && msg.text.body ? msg.text.body : "Hi";
        let botUrl = bots[userSelection] + userQuery

        console.log('botURL', botUrl)
        try {
            const { data, status } = await axios({
                "method": "get",
                "url": botUrl
            })
            console.log("getBotMessage => Bot", botUrl, " respond sucessfully");
            return data;
        } catch (error) {
            if (error.response) {
                // The request was made, but the server responded with a status code other than 2xx
                console.error('Server Error:', error.response.status, error.response.data);
            } else if (error.request) {
                // The request was made but no response was received
                console.error('No response from server:', error.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error('Error during request setup:', error.message);
            }
        }
    }
}

module.exports = { sendMessage, webhook }