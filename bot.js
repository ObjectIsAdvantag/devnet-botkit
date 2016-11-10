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

controller.hears(['now', 'current'], 'direct_message,direct_mention,mention', function (bot, message) {

    bot.reply(message, "_heard you! let's check what's happening now..._");

    Events.fetchCurrent(function (err, events) {
        if (err) {
            bot.reply(message, "*sorry, could not contact the organizers :-(*");
            return;
        }

        bot.reply(message, events);
    });

});

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
                    var about = convo.extractResponse('about');
                    var number = convo.vars["number"];
                    var keyword = convo.vars["keyword"];

                    bot.reply(message, "Looking for your event... (with keyword " + about + ")");

                }
                else {
                    // this happens if the conversation was cancelled or ended prematurely for some reason
                    bot.reply(message, 'cancelled!');
                }
            });
        });
        return;
    }

    bot.reply(message, "Looking for your event... (with keyword " + keyword + ")");
});




/*
controller.storage.users.get(message.user, function(err, user) {
    if (!user) {
        user = {
            id: message.user,
        };
    }
    user.name = name;
    controller.storage.users.save(user, function(err, id) {
        bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
    });
});
*/

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function (bot, message) {

    controller.storage.users.get(message.user, function (err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function (err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function (response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function (response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function (response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function (response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, { 'key': 'nickname' }); // store the results in a field called nickname

                    convo.on('end', function (convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function (err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function (err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });



                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});


controller.hears(['uptime', 'ping', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function (bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            'I am a bot named <@' + bot.identity.name +
            '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
