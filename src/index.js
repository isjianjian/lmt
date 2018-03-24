import {app, BrowserWindow, Tray, Menu, shell} from 'electron';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
    app.quit();
}
const electron = require('electron');
// / / Module to control application life.
// const Tray = electron.Tray
// const Menu = electron.Menu
const ipc = electron.ipcMain;
// Module to create native browser window.

const path = require('path');
const url = require('url');
const io = require('socket.io-client');
const exec = require('child_process').exec;
const fs = require('fs');
const log = require('electron-log');

// const util = require('util');
const INI = require('./lib/ini');

/**
 *
 *  TODO 打包配置
 */

// var electronInstaller = require('electron-winstaller');
//
// resultPromise = electronInstaller.createWindowsInstaller({
//     appDirectory: '/tmp/build/my-app-64',
//     outputDirectory: '/tmp/build/installer64',
//     authors: 'My App Inc.',
//     exe: 'myapp.exe'
// });
//
// resultPromise.then(() => console.log("It worked!"), (e) => console.log(`No dice: ${e.message}`));
// this should be placed at top of main.js to handle setup events quickly
// if (handleSquirrelEvent()) {
//     // squirrel event handled and app will exit in 1000ms, so don't do anything else
//     app.quit();
// }
//
// function handleSquirrelEvent() {
//   if (process.argv.length === 1) {
//     return false;
//   }
//
//   const ChildProcess = require('child_process');
//   const path = require('path');
//
//   const appFolder = path.resolve(process.execPath, '..');
//   const rootAtomFolder = path.resolve(appFolder, '..');
//   const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
//   const exeName = path.basename(process.execPath);
//
//   const spawn = function (command, args) {
//     let spawnedProcess,
//       error;
//
//     try {
//       spawnedProcess = ChildProcess.spawn(command, args, { detached: true });
//     } catch (error) {}
//
//     return spawnedProcess;
//   };
//
//   const spawnUpdate = function (args) {
//     return spawn(updateDotExe, args);
//   };
//
//   const squirrelEvent = process.argv[1];
//   switch (squirrelEvent) {
//     case '--squirrel-install':
//     case '--squirrel-updated':
//             // Optionally do things such as:
//             // - Add your .exe to the PATH
//             // - Write to the registry for things like file associations and
//             //   explorer context menus
//
//             // Install desktop and start menu shortcuts
//       spawnUpdate(['--createShortcut', exeName]);
//
//       setTimeout(app.quit, 1000);
//       return true;
//
//     case '--squirrel-uninstall':
//             // Undo anything you did in the --squirrel-install and
//             // --squirrel-updated handlers
//
//             // Remove desktop and start menu shortcuts
//       spawnUpdate(['--removeShortcut', exeName]);
//
//       setTimeout(app.quit, 1000);
//       return true;
//
//     case '--squirrel-obsolete':
//             // This is called on the outgoing version of your app before
//             // we update to the new version - it's the opposite of
//             // --squirrel-updated
//
//       app.quit();
//       return true;
//   }
// }

//

let server_status = 0;

let lives = [];
const ini___ = INI.loadFileSync('conf.ini');
let CONF = ini___.getOrCreateSection('conf');

const export_time = 10 * 60 * 1000;

/*
    TODO 服务配置
 */
// Log level
log.transports.console.level = 'info';

/**
 * Set output format template. Available variables:
 * Main: {level}, {text}
 * Date: {y},{m},{d},{h},{i},{s},{ms},{z}
 */
log.transports.console.format = '{y}-{m}-{d} {h}:{i}:{s}:{ms} [{level}] {text}';
log.transports.file.appName = 'mq';

// Same as for console transport
log.transports.file.level = 'info';
log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}:{ms} [{level}] {text}';

// Set approximate maximum log size in bytes. When it exceeds,
// the archived log will be saved as the log.old.log file
log.transports.file.maxSize = 5 * 1024 * 1024;

// Write to this file, must be set before first logging

// log.transports.file.file = __dirname + '/logs/log.log';
// fs.createWriteStream options, must be set before first logging
// you can find more information at
// https://nodejs.org/api/fs.html#fs_fs_createwritestream_path_options
log.transports.file.streamConfig = {flags: 'w'};
var log_dir = CONF.dir + '/logs/'
fs.exists(log_dir,function (exists) {
    if (!exists){
        fs.mkdir(log_dir)
    }
})
// set existed file stream
log.transports.file.stream = fs.createWriteStream(log_dir + `${new Date().getTime()}.log`);


/** *
 *   TODO 窗口配置
 */


/**
 * TODO 扩展方法
 *
 */

Array.prototype.remove = function (val) {      // 按元素删除数组
    const index = this.indexOf(val);
    if (index > -1) {
        this.splice(index, 1);
    }
};


/** *
 * TODO 菜单配置
 */
function initMenu() {
    app.setName('流媒体服务');

    const template = [
        {
            label: '选项',
            submenu: [
                {
                    label: '查看日志',
                    click() {
                        log.info("打开文件", shell.openItem(CONF.dir + "/logs"))
                    },
                },
                {
                    label: '关闭服务',
                    click() {
                        stopAll()
                        stopNginx()
                        quit = true
                        app.quit();
                    },
                }
            ],
        },
        {
            label: '设置',
            click() {
                openSet()
            },
        }
    ];

    if (process.platform === 'darwin') {
        template.unshift({
            label: '流媒体服务',
            submenu: [
                {role: 'quit'},
            ],
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}


/**
 *
 *  TODO electron区
 */


const COM_TEMP = ['@ffmpeg -re -i  @url -c:v copy -c:a copy -q:v 2  -s 720x576 -hls_wrap 10 -f hls @file',
    '@ffmpeg -f rtsp -i @url -c:v copy -c:a copy -q:v 2  -s 720x576 -hls_wrap 10 -f hls @file'];

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray = null;
let mainWindow;
let setWin;
let quit = false;
function createWindow() {
    ipc.on('get-conf', (event, arg) => {
        console.log(arg);  // prints "ping"
        event.sender.send('conf', CONF);
    });
    ipc.on('get-live', (event, arg) => {
        console.log(arg);  // prints "ping"
        sendLive()
    });
    ipc.on('up-conf', (event, arg) => {
        arg.dir = arg.dir.replace("\\", "/");
        fs.exists(arg.dir,function (exists) {
            if (!exists){
                fs.mkdir(arg.dir)
            }
        })
        if (CONF.port != arg.port || CONF.dir != arg.dir) {
            updateNginx(arg)
        }

        ini___.update('conf', arg);
        CONF = arg;

        start_live_server();
        setWin.close()
    });

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 820,
        // closable:false,
        // fullscreen:false,
        // fullscreenable:false,
        // resizable:false,
        title: '流媒体服务',
    });
    mainWindow.on('show', () => {
        sendLive();
    });
    mainWindow.on('hide', () => {

    });
    mainWindow.on('close', (e) => {
        if (!quit){
            e.preventDefault()
            mainWindow.minimize()
        }
    });

    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true,
    }));

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()
    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    initMenu();
    tray = new Tray('img/live.png');
    tray.on('click', () => {
        if (mainWindow == null) {
            createWindow();
        } else {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        }
    });

    createWindow();
    start_live_server();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    stopAll()
    stopNginx()
    log.warn("流媒体服务关闭")

});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});


/**
 *
 *  TODO 直播操作区
 */


// 启动流媒体服务器
function start_live_server() {
    log.info('流媒体服务启动');
    stopAll()

    startNginx()
    for (let i = 0; i < 1; i++) {
        addLive('http://live.hkstv.hk.lxdns.com/live/hks/playlist.m3u8', `live/test${i}.m3u8`, i, i);
    }
    const socket = io.connect('http://192.168.2.170:8001');
    socket.on('connect', (data) => {
        socket.emit('getLive');
        log.info('已连接到主服务器');
        server_status = 1;
    });
    socket.on('connect_error', (data) => {
        log.warn('连接出错...');
        server_status = 3;
    });
    socket.on('connect_timeout', (data) => {
        log.warn('连接超时...');
        server_status = 3;
    });

    socket.on('disconnect', (data) => {
        log.warn('断开连接...');
        server_status = 2;
    });
    socket.on('lives', (data) => {
        log.info(typeof data);
        stopAll();
        lives = [];
        for (let i = 0; i < data.length; i++) {
            addLive(data[i].streamAddr, data[i].address, data[i].id, data[i].name);
        }
    });
    socket.on('sendLiveMassage', (data) => {
        log.info(typeof data);
        data = JSON.parse(data);
        log.info('sendLiveMassage', data);
        if (data.order == 1) {
            addLive(data.adress, data.liveName, data.id, data.name);
            log.info('新增直播', data);
        }
        if (data.order == 2) {
            removeLive(data.id);
            addLive(data.adress, data.liveName, data.id, data.name);
            log.info('更新直播', data);
        }
        if (data.order == 3) {
            removeLive(data.id);
            log.info('删除直播', data);
        }
    });


    setInterval(() => {
        for (var i = 0; i < lives.length; i++) {
            if (lives[i].time + export_time < new Date().getTime() && lives.status != 2) {
                lives[i].exec.kill();
                lives[i].status = 0;
                lives[i].exec = init_live(lives[i].url, lives[i].filename);
                sendLive();
            }
        }
    }, 10000);
}


// 初始化流媒体
function init_live(url, filename) {
    const option = {};

    const hz = url.substring(url.lastIndexOf('.'), url.length).toLowerCase();
    var dir = filename.substring(0,filename.lastIndexOf("/"))
    fs.exists(CONF.dir + "/" + dir,function (exists) {
        if (!exists){
            fs.mkdir(CONF.dir + "/" + dir)
        }
    })
    if (hz == '.m3u8' || hz == '.flv') {
        option.type = 0;
    } else {
        option.type = 1;
    }
    option.file = CONF.dir + "/" + filename;
    return live_exec(url, option);
}

function live_exec(url, o) {       // 执行拉流命令
    let com = CONF.hls

    if (o.type  == 1) {
        com = CONF.rtsp;
    }

    com = com.replace('@ffmpeg', CONF.ffmpeg)
        .replace('@url', url)
        .replace('@file', o.file);
    log.info(com);
    const e = exec(com);

    e.stdout.on('data', (data) => {
        log.info('stdout: ', data);
    });

    e.stderr.on('data', (data) => {
        // log.info('stderr: ', data);
        const live = getlive(e);
        if (live == null){
            e.kill()
            return;
        }
        if (data.substring(0, data.indexOf('=')) == 'frame') {
            live.time = new Date().getTime();
            live.retry = 0;
            live.status = 1;
            sendLive();
        }
    });

    e.on('close', (code) => {
        const live = getlive(e);
        if (live == null) return;
        if (code != 255 && live.retry < parseInt(CONF.retry)) {
            console.log('意外退出，重新拉流');
            live.status = 0;
            live.exec = live_exec(url, o);
            live.retry++;
            sendLive();

        } else {
            log.info('直播已退出');

            live.status = 2;

            sendLive();
        }
    });

    return e;
}


function startNginx() {
    let com = "nginx.exe"
    const e = exec(com);
    e.stdout.on('data', (data) => {
        alert("启动nginx失败 " + data)
        console.log(data)
    });
    e.stderr.on('data', (data) => {
        alert("启动nginx失败 " + data)
        console.log(data)
    });
}

function stopNginx() {
    exec("nginx.exe -s stop")
    exec("taskkill /F /im nginx.exe");
}


function getlive(e) {        // 获取
    for (let i = 0; i < lives.length; i++) {
        if (lives[i].exec == e || lives[i].id == e) {
            return lives[i];
        }
    }
}

function addLive(url, filename, id, name) {  // 添加
    const live = {};
    live.url = url;
    live.id = id;
    live.filename = filename;
    live.exec = init_live(url, filename);
    live.retry = 0;
    live.time = new Date().getTime();
    live.status = 0;
    live.name = name;
    lives.push(live);
}

function removeLive(id) {   // 删除
    const live = getlive(id);

    if (live != null) {
        if (live.exec != null) {
            live.exec.kill();
        }
        lives.remove(live);
    }
}

function stopAll() {
    for (var i = 0; i < lives.length; i++) {
        if (!lives[i].exec.killed){
            lives[i].exec.kill()
        }
    }
    exec("taskkill /F /im ffmpeg.exe");
}


function sendLive() {
    if (mainWindow == null) return;
    const localLive = [];
    for (var i = 0; i < lives.length; i++) {
        const live = {};
        live.url = lives[i].url;
        live.filename = lives[i].filename;
        live.status = lives[i].status;
        live.id = lives[i].id;
        live.name = lives[i].name;
        live.time = lives[i].time;
        live.retry = lives[i].retry;
        localLive.push(live);
    }
    mainWindow.webContents.send('lives', localLive);
    mainWindow.webContents.send('status', server_status);
}


function openSet() {
    setWin = new BrowserWindow({parent: mainWindow});
    setWin.loadURL(url.format({
        pathname: path.join(__dirname, 'set.html'),
        protocol: 'file:',
        slashes: true,
    }));
    setWin.show();
}

function updateNginx(data) {
    stopNginx()
    var old = fs.readFileSync("conf/nginx_tmp.conf", "utf-8")
    console.log("old", old)
    var conf = old.replace("@DIR", data.dir).replace("@PORT", data.port)
    console.log("conf", conf)
    fs.writeFile("conf/nginx.conf", conf)
}


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
