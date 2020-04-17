var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var seconds = 0;
var multiplier = 1;
var monsterSpawnSeconds = 3;
var monstersQuantity = 1;
var monsterId = 0;
var dropId = 0;
var WORLD_WIDTH = 3200;
var WORLD_HEIGHT = 3200;

var mapGenerator = null;
var players = [];
var monsters = [];

server.listen(3000, () => {
    console.log("Hi");
});

io.on('connection', (socket) => {
    console.log('player connected x = ' + socket.x + ' , y = ' + socket.y);

    if(players.length == 0){
        // Cada cuanto spawnea un monstruo
        var monsterCreator = setInterval(() => {
            for(var i = 0; i < monstersQuantity; i++){
                var newMonster = new monster(monsterId, Math.floor(Math.random() * 3), Math.random() * (WORLD_WIDTH - 100) , Math.random() * (WORLD_HEIGHT - 100), multiplier, 0);
                io.sockets.emit('createMonster', newMonster);
                monsters.push(newMonster);
                monsterId += 1;
            }
        }, monsterSpawnSeconds * 1000);

        // Cada 4 minutos, los monstruos aparecen medio segundo mas rapido.
        var monsterSpawnerPowerUp = setInterval(() => {
            monsterSpawnSeconds -= 0.5;
        }, 180 * 1000);

        // Aumentamos multiplicador cada 120 segundos (3minutos)
        // Y la cantidad de monstruos que aparecen
        var monsterMultiplier = setInterval(() => {
            multiplier += 0.3;
            monstersQuantity += 1;
        }, 120 * 1000);

        // Soltamos un drop cada 15 segundos
        var dropCreator = setInterval(() => {
            var newDrop = new drop(dropId, Math.floor(Math.random() * 140), Math.random() * (WORLD_WIDTH - 100) , Math.random() * (WORLD_HEIGHT - 100), "0");
            io.sockets.emit('newDrop', newDrop);
            dropId += 1;
        }, 80 * 15);
    }

    setInterval(() => {
        if(players.length === 0){
            restartVars();
            monsters = [];
            clearInterval(monsterCreator);
            clearInterval(dropCreator);
            clearInterval(monsterSpawnerPowerUp);
            clearInterval(monsterMultiplier);
            monsterId = 0;
        }
    }, 3 * 1000);

    socket.emit('getMap', {map : mapGenerator});
    socket.emit('socketID', {id : socket.id});
    socket.emit('getPlayers', players);
    socket.emit('getMonsters', monsters);
    socket.broadcast.emit('newPlayer', {id : socket.id });
    socket.on('playerMoved', (data) => {
        data.id = socket.id;
        socket.broadcast.emit('playerMoved', data);

        for(var i = 0; i < players.length; i++){
            if(players[i].id == data.id){
                players[i].x = data.x;
                players[i].y = data.y;
                players[i].direction = data.direction;
            }
        }
    });

    socket.on('asReduce', () => {
        socket.broadcast.emit('asReduce');
    });

    socket.on('atkReduce', () => {
        socket.broadcast.emit('atkReduce');
    });

    socket.on('msReduce', () => {
        socket.broadcast.emit('msReduce');
    });

    socket.on('mobBoost', () => {
        socket.broadcast.emit('mobBoost');
    });

    socket.on('pickedADrop', (data) => {
        socket.broadcast.emit('pickedADrop', {dropId : data.dropId})
    });

    socket.on('bulletShot', (data) => {
        data.id = socket.id;
        socket.broadcast.emit('bulletShot', data);
    });

    socket.on('updateMonsters', (data) => {
        data.id = socket.id;
        var newMonsters = data.enemy;
        socket.broadcast.emit('updateMonsters', data);
        if(newMonsters){
            for(var i = 0; i < newMonsters.length; i++){
                for(var j = 0; j < monsters.length; j++){
                    if(monsters[j].id == newMonsters[i].id){
                        monsters[j].x = newMonsters[i].x;
                        monsters[j].y = newMonsters[i].y;
                        if(monsters[j].vidaActual > newMonsters.vidaActual){
                            monsters[j].vidaActual = newMonsters[i].vidaActual;
                        }
                    }
                }
            }
        }
    });

    socket.on('enemiesDead', (data) => {
        data.id = socket.id;
        var enemiesDead = data.enemy;
        socket.broadcast.emit('enemiesDead', data);
        if(enemiesDead){
            for(var i = 0; i < enemiesDead.length; i++){
                for(var j = 0; j < monsters.length; j++){
                    if(monsters[j].id == enemiesDead[i].id){
                        monsters.splice(i, 1);
                    }
                }
            }
        }
    });

    socket.on('playerMoved', (data) => {
        data.id = socket.id;
        socket.broadcast.emit('playerMoved', data);

        for(var i = 0; i < players.length; i++){
            if(players[i].id == data.id){
                players[i].x = data.x;
                players[i].y = data.y;
                players[i].direction = data.direction;
            }
        }
    });

    socket.on('newMap', (data) => {
        mapGenerator = data.map;
    });

    socket.on('initial', (data) => {
        data.id = socket.id;
        socket.broadcast.emit('initial', data);

        console.log("initial: " +
        "ID: " + data.id +
        "X: " + data.x +
        "Y: " + data.y);

        for(var i = 0; i < players.length; i++){
            if(players[i].id == data.id){
                players[i].x = data.x;
                players[i].y = data.y;
            }
        }
    });

    socket.on('disconnect', function(){

        socket.broadcast.emit('playerDisconnected', { id: socket.id });

        console.log('player ID ' + socket.id + ' disconnected');

        
		for(var i = 0; i < players.length; i++){
			if(players[i].id == socket.id){
				players.splice(i, 1);
			}
        }

        console.log('Players: ' + players.length);

        

    });
    
    players.push(new player(socket.id, 0, 0));
});

function player (id, x, y, direction){
    this.id = id;
    this.x = x;
    this.y = y;
    this.direction = direction;
}

function monster (id, whichEnemyId, x, y, multiplier, vidaActual){
    this.id = id;
    this.whichEnemyId = whichEnemyId;
    this.x = x;
    this.y = y;
    this.multiplier = multiplier;
    this.vidaActual = vidaActual;
}

function drop(id, range, x, y, ownerId){
    this.id = id;
    this.range = range;
    this.x = x;
    this.y = y;
    this.ownerId = ownerId;
}

function restartVars(){
    seconds = 0;
    multiplier = 1;
    monsterSpawnSeconds = 3;
    monstersQuantity = 1;
}