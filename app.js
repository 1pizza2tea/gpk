import puppeteer, { Target } from 'puppeteer';

// Подключаем библиотеку dotenv
import 'dotenv/config';

// Обращаемся к библиотеке grammy и импортируем из него класс
import { Bot, session } from "grammy";

//импорт классов для обр ошибок:
import { GrammyError, HttpError } from "grammy";

import EventEmitter from 'node:events';       //

const eventEmitter = new EventEmitter({ captureRejections: true });

// Создаем своего бота на основе импортированного класса, передавая
// в качестве аргумента ссылку на  токен  из файла .env :
const bot = new Bot(process.env.BOT_API_KEY);
//process.env.BOT_API_KEY — это и есть получение переменной окружения BOT_API_KEY.

// Запускаем созданного бота

//--------------------------------------------------------

let url = 'https://gpk.gov.by/situation-at-the-border/punkty-propuska/brest/';
let result = null;


//------------вычисляем время до ближ запуска-------------

function start_time() {
    let h = new Date().getHours();                            //12
    let m = new Date().getMinutes();                          //16
    let time_before_start_scrapper = 0;

    if (h % 2 !== 0) {                                         //13.45
        time_before_start_scrapper = ((60 - m + 15));           //=30
    }

    else if (h % 2 == 0 && m < 15) {                              //14.10
        time_before_start_scrapper = (15 - m);                //=5
    }

    else if (h % 2 == 0 && m >= 15) {                            //14.30
        time_before_start_scrapper = (60 - m + 60 + 15);         //105
    }
    return time_before_start_scrapper;
}


function repeat_time() {

    let h = new Date().getHours();                           //12
    let m = new Date().getMinutes();                         //15
    let time_before_repeat_scrapper = 10;

    if (h % 2 !== 0) {
        time_before_repeat_scrapper = start_time();      //если нечетное время то перенос на х.15
    }

    else if (h % 2 == 0 && m < 15) {
        time_before_repeat_scrapper = start_time();
    }

    else if (h % 2 == 0 && m >= 50) {
        time_before_repeat_scrapper = start_time();
    }

    else if (h % 2 == 0 && m >= 15) {
        time_before_repeat_scrapper = 10;
    }
    return time_before_repeat_scrapper;
}

//------запускаем парсер в ближ четный (час.15) -----------------

function timer() {
    console.log('запуск состоится через ' + start_time());

    setTimeout(() => {
        line_data(url)
    }, 60 * 1000 * start_time())
}
timer();

//-------------парсер-------------------------------------------

async function line_data(url) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);                           // отключаем дефолт таймаут

    console.log('code started...going to url..' + new Date().toLocaleTimeString());
    try {
        await page.goto(url);
        await page
            .waitForSelector('div.queuesNow')
            .then(() => {
                console.log('selector has appeared ' + new Date().toLocaleTimeString());
            })

        let date = await page.evaluate(() => {
            text = document.querySelector('div.queuesNow > div.queuesHeader > div.queuesTime').innerText;
            return text
        })

        let cars = await page.evaluate(() => {
            number_c = document.querySelector('.queuesTable >tbody > tr:nth-child(1) > td:nth-child(2)').innerText;
            return number_c
        })

        let buses = await page.evaluate(() => {
            number_b = document.querySelector('.queuesTable >tbody > tr:nth-child(2) > td:nth-child(2)').innerText;
            return number_b
        })

        if (date.slice(11, 13) == new Date().getHours()) {
            // console.log('час полученных данных: '+date.slice(11,13));                       //12
            // console.log('текущий час:           '+new Date().getHours());                   //12
            console.log('данные свежие, закрываю браузер ' + new Date().toLocaleTimeString());

            await browser.close();

            result = `По состоянию на <b>*${await date}*</b>
в электронной очереди из РБ в РП до заезда на терминал зарегистрировано:

    автомобилей: <b>*${await cars}*</b>
    автобусов:       <b>*${await buses}*</b>

<i>Данные обновляются каждые 2 часа</i>`;


            // console.log(result);

            eventEmitter.emit('result_changed')
            console.log(`ближ. запуск через  ${start_time()}`);

            setTimeout(() => {
                line_data(url);
            }, 60 * 1000 * start_time())


        } else {
            // console.log('час полученных данных: '+date.slice(11,13));                       //12
            // console.log('текущий час:           '+new Date().getHours());                   //12
            console.log('данные не свежие, закрываю браузер ' + new Date().toLocaleTimeString());
            console.log(`повтор через ` + repeat_time());
            await browser.close();

            setTimeout(() => {
                line_data(url)
            }, repeat_time() * 60 * 1000)                                              // перезапуск через x
        }
    }
    catch (error) {
        console.log('Catched: ' + error);
        await browser.close();

        setTimeout(() => {
            line_data(url)
        }, repeat_time() * 60 * 1000)

        console.log('повтор запуска через ' + repeat_time());
    }
}

//--------скрипт бота-----сессия--------------

function initial() {
    return {
        last_command: 'x',
    }
}
bot.use(session({ initial }));

//----------бот------------------

bot.command('start',
    async (ctx) => {
        if (ctx.message.text !== ctx.session.last_command) {               // если старт не равно сессии
            ctx.session.last_command = ctx.message.text;                 //то кладем старт в сессию

            await ctx.reply('bot started....' + new Date().toLocaleTimeString())
            let g_ctx = ctx;

            let listener = async function () {     // ф слушатель
                await g_ctx.reply(result, {
                    parse_mode: 'HTML'
                })
            }

            eventEmitter.on('result_changed', listener)    //ждем сигнал

            eventEmitter.on('error', (err) => {             // обработка блокировки юзером
                console.log(err);
                eventEmitter.removeListener('result_changed', listener);
                console.log(eventEmitter.listenerCount('result_changed')); // проверка что убран=0
                ctx.session.last_command = 'x';                               //меняем команду в сессии
            });

        }
        else {
            ctx.reply('бот уже запущен');
            return
        }                                                      //= если старт снова то выход
    }
)

//-------проверка ошибок-----------------

bot.catch((err) => {

    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);

    const e = err.error;

    if (e instanceof GrammyError) {
        console.error('Error in request::::::::::::::', e.description);

    } else if (e instanceof HttpError) {
        console.error('Could not contact Telegram:', e);

    } else {
        console.error('Unknown error:', e);
    }
});

bot.start();
