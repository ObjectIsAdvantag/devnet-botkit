//
// Copyright (c) 2016 Cisco Systems
// Licensed under the MIT License 
//

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('botkit');
var os = require('os');

//
// Bot Adapter: uncomment one among Slack, Console
//
// var controller = Botkit.consolebot({
//     debug: false,
// });
// var bot = controller.spawn();
var controller = Botkit.slackbot({
    debug: false,
});
var bot = controller.spawn({
    token: process.env.token
}).startRTM();


// event API wrapper that preformats messages to send back to Slack
var Events = require("./events.js");


//
// Command: help
//
controller.hears(["help", "who are you"], 'direct_message,direct_mention,mention', function (bot, message) {
    var text = "I am a bot, can help you find current and upcoming events at <https://developer.cisco.com|Cisco DevNet>\nCommands I understand: now, next [max], about [index]";
    bot.reply(message, { "unfurl_links": false, "text": text });
});


//
// Command: now
//
controller.hears(['now', 'current'], 'direct_message,direct_mention,mention', function (bot, message) {

    bot.reply(message, "_heard you! let's check what's happening now..._");

    Events.fetchCurrent(function (err, events, text) {
        if (err) {
            bot.reply(message, "*sorry, could not contact the organizers :-(*");
            return;
        }

        bot.reply(message, { "unfurl_links": false, "text": text });

        if (events.length == 0) {
            bot.reply(message, "_Type next for upcoming events_");
            return;
        }

        // Store events
        var toPersist = { "id": message.user, "events": events };
        controller.storage.users.save(toPersist, function (err, id) {
            bot.reply(message, "_Type about [number] for more details_");
        });
    });
});


//
// Command: next
//
controller.hears(['next\s*(.*)', 'upcomings*(.*)', 'events*(.*)'], 'direct_message,direct_mention,mention', function (bot, message) {

    bot.reply(message, "_heard you! asking my crystal ball..._");

    var limit = parseInt(message.match[1]);
    if (!limit) limit = 5;
    if (limit < 1) limit = 1;

    Events.fetchNext(limit, function (err, events, text) {
        if (err) {
            bot.reply(message, "*sorry, ball seems broken  :-(*");
            return;
        }

        bot.reply(message, { "unfurl_links": false, "text": text });

        // Store events
        var toPersist = { "id": message.user, "events": events };
        controller.storage.users.save(toPersist, function (err, id) {
            bot.reply(message, "_Type about [number] for more details_");
        });
    });

});


//
// Command: about
//
controller.hears(['show\s*(.*)', 'more\s*(.*)', 'about\s*(.*)'], 'direct_message,direct_mention,mention', function (bot, message) {

    var keyword = message.match[1];
    if (!keyword) {
        bot.startConversation(message, function (err, convo) {
            convo.ask("Which event are you inquiring about? (type a number or cancel)", [
                {
                    pattern: "cancel",
                    callback: function (response, convo) {
                        convo.next();
                    }
                },
                {
                    pattern: "([0-9]+)\s*",
                    callback: function (response, convo) {
                        var value = parseInt(response.match[1]);
                        convo.setVar("number", value);
                        convo.next();
                    }
                },
                // {
                //     pattern: "([a-zA-Z]+)\s*",
                //     callback: function (response, convo) {
                //         var value = response.match[1];
                //         convo.setVar("keyword", value);
                //         convo.next();
                //     }
                // },
                {
                    default: true,
                    callback: function (response, convo) {
                        // just repeat the question
                        convo.say("Sorry I did not understand, either specify a number or cancel");
                        convo.repeat();
                        convo.next();
                    }
                }
            ], { 'key': 'about' });

            convo.on('end', function (convo) {
                if (convo.status == 'completed') {

                    //var about = convo.extractResponse('about');
                    var number = convo.vars["number"];
                    if (number) {
                        displayEvent(bot, controller, message, number);
                        return;
                    }

                    // not cancel, nor a number
                    bot.reply(message, 'cancelled!');
                }
                else {
                    // this happens if the conversation was ended prematurely for some reason
                    bot.reply(message, "sorry, could not process your request, try again..");
                }
            });
        });
        return;
    }

    // Check arg for number
    var number = parseInt(keyword);
    if (number) {
        displayEvent(bot, controller, message, number);
        return;
    }
    
    // Not a number
    bot.reply(message, "sorry, not implemented yet!");
});


//
// Utilities
//

function displayEvent(bot, controller, message, number) {
    controller.storage.users.get(message.user, function (err, user_data) {
        if (!user_data) {
            bot.reply(message, "Please look for current or upcoming events, before inquiring about event details");
            return;
        }

        var events = user_data["events"];
        if (number <= 0) number = 1;
        if (number > events.length) number = events.length;
        if (number == 0) {
            bot.reply(message, "sorry, seems we don't have any event to display details for");
            return;
        }

        var event = events[number - 1];
        bot.reply(message, { "unfurl_links": false, "text": Events.generateEventsDetails(event) });
    });
}


