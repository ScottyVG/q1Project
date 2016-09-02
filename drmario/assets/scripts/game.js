var Game = {};

var blocksPerPill = 2;
var numColors = 3;
var blockSize = 32;
var blocksY = 16;
var blocksX = 8;
var gameWidth = blocksX * blockSize;
var menuWidth = 300;
var movementLag = 100; // Delay in ms below which two consecutive key presses are counted as the same one (to avoid rapid fire)
var blockValue = 1; // value in the grid of a cell occupied by a block of a fallen pill
var occupiedValue = 2; // value in the grid of a cell occupied by a block of the currently falling pill
var redValue = 1;
var blueValue = 2;
var yellowValue = 3;
var virusNumber = 10;

//score details
var score = 0; // score of the player
// by how much the score increases with each completed lineOfFour
var scoreIncrement = 50;
var completedLines = 0;
// number of linesOfFour to complete before the falling speed and points reward increase
var linesThreshold = 3;
// by how much (in ms) does the falling speed increase every linesThreshold lines completed
var speedUp = 100;
// by how much does the points reward increase every linesThreshold linesOfFour completed
var scorePlus = 25;
// Falling speed of the falling pill (one block per second initially)
var timeOut = Phaser.Timer.SECOND;

// contains the list the next pill to be displayed
var queue = [];
var pauseState = false;
var gameOverState = false;

// the positions of each block of a pill with respect to its center (in cell coordinates)
var offsets = {
  0: [
    [0, 0],
    [-1, 0]
  ]
};

// The amount of cells ([x,y]) by which the pilles move in each direction
var move_offsets = {
  "left": [-1, 0],
  "down": [0, 1],
  "right": [1, 0]
};

var pill, cursors, rotates, pause, pauseText, scoreTitle, scoreText, virusText, scene, sceneSprites, sceneColor, timer, loop, shade;
// counter to prevent excessive movements when key press or multiple key downs
var currentMovementTimer = 0;

// return a random not zero Number
function randomNumber(input) {
  var rNum = Math.floor(Math.random() * input) + 1;
  // console.log(rNum);
  return rNum;
}

function getCellName(row, col) {
  return "cell_" + row + "_" + col;
}

// The pill used to represent the falling pill
function Pill() {
  this.shape = 0;
  this.colorLeft = randomNumber(numColors);
  this.colorRight = randomNumber(numColors);
  // list of the cell colors occupied by the pill
  this.color = [this.colorRight, this.colorLeft];
  console.log('left: ' + this.colorLeft);
  console.log('right: ' + this.colorRight);

  // list of the sprites of each block
  this.sprites = [];
  // list of the cells occupied by the pill
  this.cells = [];
  this.center = [0, 0];
  // materialize makes the pill appear, either in the scene (inGame = true) or on the right (inGame = false) if it's the next pill
  this.materialize = function(c_x, c_y, inGame) {
    this.center = [c_x, c_y];
    this.cells = [];
    // clean previous sprites if any
    for (var j = 0; j < this.sprites.length; j++) {
      this.sprites[j].destroy();
    }
    this.sprites = [];
    // Are there occupied cells where the pill will appear? If yes -> game over
    var conflict = false;
    for (var i = 0; i < blocksPerPill; i++) {
      // Compute the coordinates of each block of the pill, using the offset
      var x = c_x + offsets[this.shape][i][0];
      var y = c_y + offsets[this.shape][i][1];
      var sprite = game.add.sprite(x * blockSize, y * blockSize, 'singlePills', this.color[i]);
      this.sprites.push(sprite);
      this.cells.push([x, y]);
      this.spriteColor = this.color[i]
      console.log('SpriteColor:' + this.spriteColor);
      if (inGame) {
        if (!validateCoordinates(x, y)) {
          conflict = true;
        }
        // 1 for blocks of current pill, 2 for fallen pills
        scene[x][y] = blockValue;
      }
    }
    return conflict;
  };
}

// Sound - stores sound info
Game.radio = {
  soundOn: true,
  moveSound: null,
  gameOverSound: null,
  winSound: null,
  music: null,

  // Play music if all conditions are met
  playMusic: function() {
    if (Game.radio.soundOn && !pauseState) {
      Game.radio.music.resume();
    }
  },
  // Toggle sound on/off
  manageSound: function(sprite) {
    sprite.frame = 1 - sprite.frame;
    Game.radio.soundOn = !Game.radio.soundOn;
    if (Game.radio.soundOn) {
      Game.radio.playMusic();
    } else {
      Game.radio.music.pause();
    }
  },
  // Play sound if all conditions are met
  playSound: function(sound) {
    if (Game.radio.soundOn && !pauseState) {
      sound.play();
    }
  }
};

Game.preload = function() {
  game.load.spritesheet('pills', 'assets/pillSpriteSheet.png', blockSize, blockSize, numColors);
  game.load.spritesheet('singlePills', 'assets/singlePillSpriteSheet.png', blockSize, blockSize, numColors);
  game.load.spritesheet('virus', 'assets/virusSpriteSheet.png', blockSize, blockSize, numColors);
  game.load.spritesheet('blocks', 'assets/blocks.png', blockSize, blockSize, numColors);
  game.load.spritesheet('sound', 'assets/sound.png', 32, 32); // Icon to turn sound on/off
  game.load.audio('move', 'assets/sound/move.mp3', 'assets/sound/move.ogg');
  game.load.audio('win', 'assets/sound/win.mp3', 'assets/sound/win.ogg');
  game.load.audio('gameover', 'assets/sound/gameover.mp3', 'assets/sound/gameover.ogg');
};

Game.create = function() {

  // 2D array of blocksX*blocksY cells corresponding to the playable scene; will contain 0 for empty, 1 if there is already
  // a block from the current pill, and 2 if there is a block from a fallen pill
  scene = [];
  // Array that stores sprites
  sceneSprites = [];
  // Fills the two arrays with empty cells
  var boardDimensions = [8, 16];

  for (var i = 0; i < boardDimensions[0]; i++) {
    var col = [];
    var spriteCol = [];

    for (var j = 0; j < boardDimensions[1]; j++) {
      col.push(0);
      spriteCol.push(null);
    }
    scene.push(col);
    sceneSprites.push(spriteCol);
  }

  // placeViruses();

  pauseState = false;
  gameOverState = false;

  // Places separator between the scene and the right pannel
  var middleSeparator = game.add.graphics(gameWidth, 0);
  middleSeparator.lineStyle(3, 0xffffff, 1);
  middleSeparator.lineTo(0, game.world.height);
  placeSeparators();


  //ground
  game.add.tileSprite(0, game.world.height - blockSize, gameWidth, blockSize, 'blocks', 0);


  // Sound on/off icon
  var sound = game.add.sprite(game.world.width - 38, 0, 'sound', 0);
  sound.inputEnabled = true;
  sound.events.onInputDown.add(Game.radio.manageSound, this);

  // Text for the score, number of lines, next pill
  scoreTitle = game.add.bitmapText(gameWidth + 50, 50, 'videogame', 'Score', 20);
  scoreText = game.add.bitmapText(gameWidth + 50, 100, 'desyrel', '0', 40);
  var linesTitle = game.add.bitmapText(gameWidth + 50, 200, 'videogame', 'Viruses', 20);
  virusText = game.add.bitmapText(gameWidth + 50, 250, 'desyrel', '0', 40);
  var nextTitle = game.add.bitmapText(gameWidth + 75, 350, 'videogame', 'Next', 20);
  alignText();
  nextTitle.x = scoreTitle.x + scoreTitle.textWidth / 2 - (nextTitle.textWidth * 0.5);
  linesTitle.x = scoreTitle.x + scoreTitle.textWidth / 2 - (linesTitle.textWidth * 0.5);

  // spawn a new pill and the scene and update the next one
  managePills();

  // Register the keys selected by the player on the menu screen. It might not be the best practice to feed in the raw values
  // from the form, but I didn't want to focus too much on this functionality.
  game.input.keyboard.enabled = true;

  // Movement keys
  cursors = {
    right: game.input.keyboard.addKey(Phaser.Keyboard[document.getElementById("moveright").value]),
    left: game.input.keyboard.addKey(Phaser.Keyboard[document.getElementById("moveleft").value]),
    down: game.input.keyboard.addKey(Phaser.Keyboard[document.getElementById("movedown").value])
  };

  // Rotation keys
  rotates = {
    counterClockwise: game.input.keyboard.addKey(Phaser.Keyboard[document.getElementById("rotateright").value]),
    clockwise: game.input.keyboard.addKey(Phaser.Keyboard[document.getElementById("rotateleft").value])
  };
  pause = game.input.keyboard.addKey(Phaser.Keyboard[document.getElementById("pause").value]);

  // Timer to make the the falling pill fall
  timer = game.time.events;
  loop = timer.loop(timeOut, fall, this);
  timer.start();

  // Sound effets and Game.radio.music
  Game.radio.moveSound = game.add.audio('move');
  Game.radio.winSound = game.add.audio('win');
  Game.radio.gameOverSound = game.add.audio('gameover');
  Game.radio.music = game.add.audio('music');
  Game.radio.music.volume = 0.2;
  Game.radio.music.loopFull();
};

// Create Viruses
// function placeViruses(virusNumber) {
//   var successful = false;
//   for (var n_whole_attempts = 0; n_whole_attempts < 25 && !successful; ++n_whole_attempts) {
//     successful = true;
//     // Clear out the board.
//     for (var column = 0; column < boardDimensions[0]; column++) {
//       for (var row = 0; row < boardDimensions[3]; row++) {
//         this.scene[column][row].color = 0;
//         this.scene[column][row].is_virus = false;
//       }
//     }
//     this.scene.num_of_each_virus = [];
//     for (var n_color = 0; n_color < numColors; n_color++) {
//       this.scene.num_of_each_virus[n_color] = 0;
//     }
//
//
//   }
// }

function updateScore() {
  score += scoreIncrement;
  completedLines++;
  scoreText.text = score;
  virusText.text = completedLines;
  alignText();
  updateTimer();
}

function updateTimer() {
  if (completedLines % linesThreshold == 0) {
    loop.delay -= speedUp; // Accelerates the fall speed
    scoreIncrement += scorePlus; // Make linesOfFour more rewarding
  }
}

function alignText() {
  var center = scoreTitle.x + scoreTitle.textWidth / 2;
  scoreText.x = center - (scoreText.textWidth * 0.5);
  virusText.x = center - (virusText.textWidth * 0.5);
}

function managePills() {
  // Keep the queue filled with as many pills as needed
  while (queue.length < 2) {
    // adds at beginning of array
    queue.unshift(new Pill());
  }
  // the last one will be put on the stage
  pill = queue.pop();
  var start_x = Math.floor(blocksX / 2);
  var start_y = 0;
  var conflict = pill.materialize(start_x, start_y, true);
  if (conflict) {
    gameOver();
  } else {

    // display the next pill(s)
    for (var i = 0; i < queue.length; i++) {
      var s_x = Math.floor((scoreTitle.x + scoreTitle.textWidth / 2) / 32);
      var s_y = 14;
      queue[i].materialize(s_x, s_y, false);
    }
  }
}

// Move a block of the falling pill left, right or down
function slide(block, dir) {
  var new_x = pill.cells[block][0] + move_offsets[dir][0];
  var new_y = pill.cells[block][1] + move_offsets[dir][1];
  return [new_x, new_y];
}

// Move the center of the falling pill left, right or down
function slideCenter(dir) {
  var new_center_x = pill.center[0] + move_offsets[dir][0];
  var new_center_y = pill.center[1] + move_offsets[dir][1];
  return [new_center_x, new_center_y];
}

// Rotate a block of the falling pill (counter)clockwise
function rotate(block, dir) {
  var c_x = pill.center[0];
  var c_y = pill.center[1];
  var offset_x = pill.cells[block][0] - c_x;
  var offset_y = pill.cells[block][1] - c_y;

  // Adjust for the JS coordinates system instead of Cartesian
  offset_y = -offset_y;
  var new_offset_x = ((dir == "clockwise")) ? offset_y : -offset_y;
  var new_offset_y = ((dir == "clockwise")) ? -offset_x : offset_x;
  new_offset_y = -new_offset_y;
  var new_x = c_x + new_offset_x;
  var new_y = c_y + new_offset_y;
  return [new_x, new_y];
}

// Uses the passed callback to check if the desired move (slide or rotate) doesn't conflict with a pill or virus
function canMove(coordinatesCallback, dir) {
  if (pauseState) {
    return false;
  }
  for (var i = 0; i < pill.cells.length; i++) {
    // return coords in terms of cells, not pixels
    var new_coord = coordinatesCallback(i, dir);
    var new_x = new_coord[0];
    var new_y = new_coord[1];
    if (!validateCoordinates(new_x, new_y)) {
      return false;
    }
  }
  return true;
}

function validateCoordinates(new_x, new_y) {
  if (new_x < 0 || new_x > blocksX - 1) {
    //console.log('Out of X bounds');
    return false;
  }
  if (new_y < 0 || new_y > blocksY - 1) {
    //console.log('Out of Y bounds');
    return false;
  }
  if (scene[new_x][new_y] === occupiedValue) {
    // console.log('Cell is occupied');
    return false;
  }
  return true;
}

// Move (slide or rotate) a pill according to the provided callback
function move(coordinatesCallback, centerCallback, dir, soundOnMove) {
  for (var i = 0; i < pill.cells.length; i++) {
    var old_x = pill.cells[i][0];
    var old_y = pill.cells[i][1];
    var new_coord = coordinatesCallback(i, dir);
    var new_x = new_coord[0];
    var new_y = new_coord[1];
    pill.cells[i][0] = new_x;
    pill.cells[i][1] = new_y;
    pill.sprites[i].x = new_x * blockSize;
    pill.sprites[i].y = new_y * blockSize;
    scene[old_x][old_y] = 0;
    scene[new_x][new_y] = blockValue;
  }
  if (centerCallback) {
    var center_coord = centerCallback(dir);
    pill.center = [center_coord[0], center_coord[1]];
  }
  if (soundOnMove) {
    Game.radio.playSound(Game.radio.moveSound);
  }
}

function lineSum(l) {
  var sum = 0;
  for (var k = 0; k < blocksX; k++) {
    sum += scene[k][l];
  }
  return sum
}

// check if the lines corresponding to the y coordinates in lines are full ; if yes, clear them and collapse the lines above
function checkLines(linesOfFour) {
  var collapsedLines = [];
  for (var j = 0; j < linesOfFour.length; j++) {
    var sum = lineSum(linesOfFour[j]);
    // A line is completed if all the cells of that line are marked as occupied
    if (sum == (blocksX * occupiedValue)) {
      // the lineOfFour is full
      updateScore();
      collapsedLines.push(linesOfFour[j]);
      Game.radio.playSound(Game.radio.winSound);
      cleanLine(linesOfFour[j]);
    }
  }
  if (collapsedLines.length) {
    collapse(collapsedLines);
  }
}

// Remove all blocks from a filled line
function cleanLine(lineOfFour) {
  var delay = 0;
  for (var k = 0; k < blocksX; k++) {
    // Make a small animation to send the removed blocks flying to the top
    var tween = game.add.tween(sceneSprites[k][lineOfFour]);
    tween.to({
      y: 0
    }, 500, null, false, delay);
    tween.onComplete.add(destroy, this);
    tween.start();
    sceneSprites[k][lineOfFour] = null;
    scene[k][lineOfFour] = 0;
    delay += 50;
    // For each block, start the tween 50ms later so they move wave-like
  }
}

function destroy(sprite) {
  sprite.destroy();
}

// Once a lone has been cleared, make the linesOfFour above it fall down ; the argument linesOfFour is a list of the y coordinates of the
// linesOfFour that have been cleared
function collapse(linesOfFour) {
  // Find the min y value of the cleared linesOfFour, i.e. the highermost cleared line ; only lines above that one have to collapse
  var min = 999;
  for (var k = 0; k < linesOfFour.length; k++) {
    if (linesOfFour[k] < min) {
      min = linesOfFour[k];
    }
  }
  // From the highermost cleared lineOfFour - 1 to the top, collapse the linesOfFour
  for (var i = min - 1; i >= 0; i--) {
    for (var j = 0; j < blocksX; j++) {
      if (sceneSprites[j][i]) {
        // linesOfFour.length = the number of linesOfFour that have been cleared simultaneously
        sceneSprites[j][i + linesOfFour.length] = sceneSprites[j][i];
        sceneSprites[j][i] = null;
        scene[j][i + linesOfFour.length] = occupiedValue;
        scene[j][i] = 0;
        // Make some animation to collapse the linesOfFour
        var tween = game.add.tween(sceneSprites[j][i + linesOfFour.length]);
        var new_y = sceneSprites[j][i + linesOfFour.length].y + (linesOfFour.length * blockSize);
        tween.to({
          y: new_y
        }, 500, null, false);
        tween.start();
      }
    }
  }
}


// Makes the falling pill fall
function fall() {
  if (pauseState || gameOverState) {
    return;
  }
  if (canMove(slide, "down")) {
    move(slide, slideCenter, "down", 0);
  } else {
    // If it cannot move down, it means it is touching fallen blocks ; it's time to see if a line has been completed
    // and to spawn a new falling pill
    var linesOfFour = [];
    for (var i = 0; i < pill.cells.length; i++) {
      // Make a set of the y coordinates of the falling pill ; the lines corresponding to those y coordinates will be
      // checked to see if they are full
      if (linesOfFour.indexOf(pill.cells[i][1]) == -1) { // if the value is not yet in the list ...
        linesOfFour.push(pill.cells[i][1]);
      }
      var x = pill.cells[i][0];
      var y = pill.cells[i][1];
      scene[x][y] = occupiedValue;
      sceneSprites[pill.cells[i][0]][pill.cells[i][1]] = pill.sprites[i];
    }
    checkLines(linesOfFour); // check if linesOfFour are completed
    managePills(); // spawn a new pill and update the next one
  }
}

// function displayScene() {
//   console.log('Scene length' + scene.length);
//   for (var i = 0; i < scene.length; i++) {
//     for (var j = 0; j < scene[i].length; j++) {
//       // console.log(scene[i][j]);
//       // console.log(sceneColor[i][j]);
//     }
//   }
// }

// Puts a shade on the stage for the game over and pause screens
function makeShade() {
  shade = game.add.graphics(0, 0);
  shade.beginFill(0x000000, 0.6);
  shade.drawRect(0, 0, game.world.width, game.world.height);
  shade.endFill();
}

function managePauseScreen() {
  pauseState = !pauseState;
  if (pauseState) {
    Game.radio.music.pause();
    makeShade();
    pauseText = game.add.bitmapText(game.world.centerX, game.world.centerY, 'videogame', 'PAUSE', 64);
    pauseText.anchor.setTo(0.5);

  } else {
    timer.resume();
    Game.radio.playMusic();
    shade.clear();
    pauseText.destroy();
  }
}

function gameOver() {
  gameOverState = true;
  game.input.keyboard.enabled = false;
  Game.radio.music.pause();
  Game.radio.playSound(Game.radio.gameOverSound);
  makeShade();
  var gameover = game.add.bitmapText(game.world.centerX, game.world.centerY, 'gameover', 'GAME OVER', 50);
  gameover.anchor.setTo(0.5);
}

Game.update = function() {
  currentMovementTimer += this.time.elapsed;
  if (currentMovementTimer > movementLag) {
    // Prevents rapid firing
    if (pause.isDown) {
      managePauseScreen();
    }
    if (cursors.left.isDown) {
      if (canMove(slide, "left")) {
        move(slide, slideCenter, "left", 1);
      }
    } else if (cursors.right.isDown) {
      if (canMove(slide, "right")) {
        move(slide, slideCenter, "right", 1);
      }
    } else if (cursors.down.isDown) {
      if (canMove(slide, "down")) {
        move(slide, slideCenter, "down", 1);
      }
    } else if (rotates.clockwise.isDown) {
      if (canMove(rotate, "clockwise")) {
        move(rotate, null, "clockwise", 1);
      } else {
        console.log('Cannot rotate');
      }
    } else if (rotates.counterClockwise.isDown) {
      if (canMove(rotate, "counterclockwise")) {
        move(rotate, null, "counterclockwise", 1);
      } else {
        console.log('Cannot rotate');
      }
    }
    currentMovementTimer = 0;
  }
};
