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

var controller = Botkit.slackbot({
    debug: false,
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();


// event API wrapper that preformats messages to send back to Slack
var Events = require("./events.js");

//
//
//
controller.hears(['now', 'current'], 'direct_message,direct_mention,mention', function (bot, message) {

    bot.reply(message, "_heard you! let's check what's happening now..._");

    Events.fetchCurrent(function (err, events, text) {
        if (err) {
            bot.reply(message, "*sorry, could not contact the organizers :-(*");
            return;
        }

        bot.reply(message, text);

        // Store events
        //var toStore = { ordered: events };
        var toPersist = { "id": message.user, "events": events };
        controller.storage.users.save(toPersist, function (err, id) {
            bot.reply(message, "_Type about [number] to get more details for an event_");
        });
    });
});


//
//
//
controller.hears(['next\s*(.*)', 'upcomings*(.*)', 'events*(.*)'], 'direct_message,direct_mention,mention', function (bot, message) {

    bot.reply(message, "_heard you! asking my crystal ball..._");

    var limit = parseInt(message.match[1]);
    //var limit = parseInt(command.args[0]);
    if (!limit) limit = 5;
    if (limit < 1) limit = 1;

    Events.fetchNext(limit, function (err, events) {
        if (err) {
            bot.reply(message, "*sorry, ball seems broken  :-(*");
            return;
        }

        bot.reply(message, events);
    });

});


//
//
//
controller.hears(['show\s*(.*)', 'more\s*(.*)', 'about\s*(.*)'], 'direct_message,direct_mention,mention', function (bot, message) {

    var keyword = message.match[1];
    if (!keyword) {
        bot.startConversation(message, function (err, convo) {
            convo.ask("Which event are you inquiring about? (type a number, a keyword or cancel)", [
                {
                    pattern: "cancel",
                    callback: function (response, convo) {
                        //convo.say("as you wish!");
                        convo.next();
                    }
                },
                {
                    pattern: "([0-9]+)\s*",
                    callback: function (response, convo) {
                        var value = parseInt(response.match[1]);
                        //convo.say("Picking event number " + keyword);
                        convo.setVar("number", value);
                        convo.next();
                    }
                },
                {
                    pattern: "([a-zA-Z]+)\s*",
                    callback: function (response, convo) {
                        var value = response.match[1];
                        //convo.say("Picking event with keyword " + keyword);
                        convo.setVar("keyword", value);
                        convo.next();
                    }
                },
                {
                    default: true,
                    callback: function (response, convo) {
                        // just repeat the question
                        convo.say("Sorry I did not understand, either specify a number or a keyword (a-Z)");
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
                        // Extracting 
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
                            bot.reply(message, Events.generateEventsDetails(event));
                        });

                        return;
                    }

                    var keyword = convo.vars["keyword"];
                    bot.reply(message, "sorry, not implemented yet! please specify a number for now...");
                }
                else {
                    // this happens if the conversation was cancelled or ended prematurely for some reason
                    bot.reply(message, 'cancelled!');
                }
            });
        });
        return;
    }

    // Respond from arguments
    bot.reply(message, "sorry, not implemented yet!");
});


//
//
//
controller.hears(["help", "who are you"], 'direct_message,direct_mention,mention', function (bot, message) {
    bot.reply(message, "I am a bot, can help you find current and upcoming events at <https://developer.cisco.com|Cisco DevNet>\nCommands I understand: now, next, about");
});



