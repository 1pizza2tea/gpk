import puppeteer, { Target } from 'puppeteer';

// Подключаем библиотеку dotenv
import 'dotenv/config';

// Обращаемся к библиотеке grammy и импортируем из него класс
import { Bot,session } from "grammy";

//импорт классов для обр ошибок:
import {  GrammyError, HttpError } from "grammy";

import EventEmitter from 'node:events';       //

const eventEmitter = new EventEmitter({ captureRejections: true });

// Создаем своего бота на основе импортированного класса, передавая
// в качестве аргумента ссылку на  токен  из файла .env :
const bot = new Bot (process.env.BOT_API_KEY);
//process.env.BOT_API_KEY — это и есть получение переменной окружения BOT_API_KEY.

// Запускаем созданного бота

//--------------------------------------------------------

let url = 'https://gpk.gov.by/situation-at-the-border/punkty-propuska/brest/';
let result = null;

//------------вычисляем время до ближ запуска-------------
function start_time(){
    let h = new Date().getHours();        //12
    let m = new Date().getMinutes();      //15
    let time_before_start_scrapper = 0;

    if(h %2 !== 0 ) {
        time_before_start_scrapper = ((60- m +15));
    }

    else if(h %2==0 && m < 15) {
        time_before_start_scrapper = (15 - m);
    }

    else if (h %2==0 && m >= 15) {
        time_before_start_scrapper =(60 - m +60 +15);
    }
    return time_before_start_scrapper;
}

//------запускаем парсер в ближ четный (час.15) -----------------

function timer() {
    console.log('запуск состоится через '+start_time());

    setTimeout(()=>{
        line_data(url)
    }, 60*1000* start_time() )
}
timer();

//-------------парсер-------------------------------------------

async function line_data(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(0);                           // отключаем дефолт таймаут

    console.log('code started...going to url..'+ new Date().toLocaleTimeString());

    await page.goto(url);
    await page
        .waitForSelector('div.queuesNow')
        .then(()=>{
            console.log( 'selector has appeared '+ new Date().toLocaleTimeString());
        })

    let date  = await page.evaluate( () => {
        text = document.querySelector('div.queuesNow > div.queuesHeader > div.queuesTime').innerText;
        return text} )

    let cars  = await page.evaluate( () => {
        number_c = document.querySelector('.queuesTable >tbody > tr:nth-child(1) > td:nth-child(2)').innerText;
        return number_c} )

    let buses  = await page.evaluate( () => {
        number_b = document.querySelector('.queuesTable >tbody > tr:nth-child(2) > td:nth-child(2)').innerText;
        return number_b} )

    if (date.slice(11,13) == new Date().getHours()) {
        console.log('час полученных данных: '+date.slice(11,13));                       //12
        console.log('текущий час:           '+new Date().getHours());                   //12
        console.log('данные свежие, закрываю браузер '+ new Date().toLocaleTimeString());

        await browser.close();

        result =  `${ await date} ${await cars} ${ await buses}`;
        console.log(result);

        eventEmitter.emit('result_changed')
        console.log(`новый запуск через  ${start_time()}`);


        setTimeout(()=>{
            line_data(url);
        }, 60*1000* start_time())


    } else {
        console.log('час полученных данных: '+date.slice(11,13));                       //12
        console.log('текущий час:           '+new Date().getHours());                   //12
        console.log('данные не свежие, закрываю браузер '+ new Date().toLocaleTimeString());
        console.log(`новый запуск через 10 мин`);
        await browser.close();

        setTimeout(() => {
            line_data(url)
        }, 10 *60*1000)                                              // перезапуск через 10
    }

}

//line_data(url);


//--------скрипт бота-----сессия--------------

function initial() {
    return {
        last_command: 'x',
    }
}
bot.use(session({ initial }));

//----------бот------------------

bot.command ( 'start',
    async (ctx)=>{
        if(ctx.message.text !==ctx.session.last_command) {               // если старт не равно сессии
            ctx.session.last_command = ctx.message.text;                 //то кладем старт в сессию

            await ctx.reply ('bot started....'+new Date().toLocaleTimeString())
            let g_ctx = ctx;

            let listener =async function () {     // ф слушатель
                await g_ctx.reply (result)
            }

            eventEmitter.on ('result_changed', listener)    //ждем сигнал

            eventEmitter.on('error', (err) => {             // обработка блокировки юзером
                console.log(err.error_code);
                eventEmitter.removeListener ('result_changed',listener);
                console.log(eventEmitter.listenerCount('result_changed')); // проверка что убран=0
                ctx.session.last_command='x';                               //меняем команду в сессии
            });

        }
        else {
            ctx.reply('бот уже запущен');
            return
        }                                                      //= если старт снова то выход
    }
)

bot.catch((err) => {

    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);

    const e = err.error;

    if (e instanceof GrammyError) {
      console.error('Error in request:::::::::::::::', e.description);

    } else if (e instanceof HttpError) {
      console.error('Could not contact Telegram:', e);

    } else {
      console.error('Unknown error:', e);
    }
  });

bot.start();

//https://github.com/1pizza2tea/gpk.git

/*git

// bot.on("my_chat_member", async(ctx)=> {
//     ctx.session.status = (ctx.myChatMember.new_chat_member.status)                       //вносим статус в session

    // let user_name = ctx.myChatMember.from.first_name;
    // let bot_name =ctx.me.first_name;
    // let reply = `Привет, ${user_name}, меня зовут ${bot_name}, приятно познакомиться)`;
    // await ctx.reply(ctx.session.status)

// function timer() {
//     setInterval(()=> {

//         line_data();



//     },1111111111 )
// }

// (function timer() {
//     setInterval(() => {
//        result  = new Date();

//        eventEmitter.emit('result_changed');
//     }, 5000)
// })();


*/
/*
let arr = Array.from(document.querySelector('.search-result-block').children);
arr.forEach((item) => {
    console.log(item.dataset.free_seats_info)})

*/
   // console.log('page opened, waiting for coockie........');
    // const coockie =  page.locator('#js-cookie-alert-close');
    // await coockie.click();
    // console.log('cockie accepted');
