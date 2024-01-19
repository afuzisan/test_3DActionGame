// aiueo.js
var Aiueo = pc.createScript('aiueo');

// initialize code called once per entity
Aiueo.prototype.initialize = function () {
    this.entity.collision.on('collisionstart', this.onCollisionStart, this);
};

Aiueo.prototype.update = function (dt) {
    // エンティティのローカル空間での前方ベクトルを取得
    var forward = this.entity.forward;
    var pos = this.entity.getLocalPosition();
    var distance = forward.clone().scale(0.1 * dt);
    pos.add(distance);
    pos.x -= forward.x / 100;
    pos.y -= forward.y / 100;
    pos.z -= forward.z / 100;
    this.entity.setLocalPosition(pos);
    var keyboard = this.app.keyboard;
    if (keyboard.isPressed(pc.KEY_D)) {
        this.entity.rotateLocal(0, 1, 0);

    } else if (keyboard.isPressed(pc.KEY_A)) {
        this.entity.rotateLocal(0, -1, 0);
    }
}


Aiueo.prototype.onCollisionStart = function (event) {
    // 衝突した相手のエンティティを取得
    var other = event.other;
    if (other.rigidbody) {
        console.log('衝突した')
        if (other.tags.has('yuka')) {

            console.log('yuka')

        } else if (other.tags.has('box')) {
            console.log('boxに衝突')
            //endシーンに行く
            startScene(this)
        } else if (other.tags.has('gameover')) {
            console.log('gameover')
            startScene(this)
        } else if (other.tags.has('point')) {
            console.log('point入りました')
            this.app.point += 10;
            pc.point.element.text = this.app.point
            // this.entity.element.text = this.app.point
        }
    }
};



// character-controller.js
var CharacterController = pc.createScript('characterController');

CharacterController.attributes.add('speed', { type: 'number', default: 5 });
CharacterController.attributes.add('jumpImpulse', { type: 'number', default: 400 });

// エンティティごとに一度呼び出される初期化コード
CharacterController.prototype.initialize = function() {
    this.groundCheckRay = new pc.Vec3(0, -1.2, 0);
    this.rayEnd = new pc.Vec3();

    this.groundNormal = new pc.Vec3();
    this.onGround = true;
    this.jumping = false;
};

CharacterController.prototype.move = function (direction) {
    if (this.onGround && !this.jumping) {
        var tmp = new pc.Vec3();

        var length = direction.length();
        if (length > 0) {
            // 現在の地面の表面に平行な新しい前方ベクトルを計算する
            tmp.cross(this.groundNormal, direction).cross(tmp, this.groundNormal);
            tmp.normalize().scale(length * this.speed);
        }
        this.entity.rigidbody.linearVelocity = tmp;
    }
};

CharacterController.prototype.jump = function () {
    if (this.onGround && !this.jumping) {
        this.entity.rigidbody.applyImpulse(0, this.jumpImpulse, 0);
        this.onGround = false;
        this.jumping = true;
        setTimeout(function () {
            this.jumping = false;
        }.bind(this), 500);
    }
};

// フレームごとに呼び出される更新コード
CharacterController.prototype.update = function(dt) {
    var pos = this.entity.getPosition();
    this.rayEnd.add2(pos, this.groundCheckRay);

    // リジッドボディの底部より少し下に直線のレイを発射します。
    // 何かに当たった場合、キャラクターは何かの上に立っています。
    var result = this.app.systems.rigidbody.raycastFirst(pos, this.rayEnd);
    this.onGround = !!result;
    if (result) {
        this.groundNormal.copy(result.normal);
    }
};


// add-single-collision-mesh.js
var AddSingleCollisionMesh = pc.createScript('addSingleCollisionMesh');
AddSingleCollisionMesh.attributes.add('modelContainerAsset', {type: 'asset', assetType: 'container'});


// エンティティごとに一度だけ呼び出される初期化コード
AddSingleCollisionMesh.prototype.initialize = function() {
    if (this.entity.collision && this.entity.collision.type === 'mesh') {
        this.entity.collision.asset = this.modelContainerAsset.resource.model;
    }    
};


// first-person-view.js
////////////////////////////////////////////////////////////////////////////////
//         キャラクターコントローラを駆動する一人称視点のコントロール            //
////////////////////////////////////////////////////////////////////////////////
var FirstPersonView = pc.createScript('firstPersonView');

FirstPersonView.attributes.add('camera', {
    title: 'Camera',
    description: '一人称視点によって制御されるカメラ。',
    type: 'entity'
});

FirstPersonView.prototype.initialize = function() {
    var app = this.app;

    // ユーザーがFPSビューのカメラエンティティを設定したか確認
    if (!this.camera) {
        // キャラクターコントローラの子要素で 'Camera' という名前のものを探す
        this.camera = this.entity.findByName('Camera');
        if (!this.camera) {
            // カメラ作成
            this.camera = new pc.Entity('FPS Camera');
            this.camera.addComponent('camera');
        }
    }

    this.x = new pc.Vec3();
    this.z = new pc.Vec3();
    this.heading = new pc.Vec3();
    this.magnitude = new pc.Vec2();

    this.azimuth = 0;
    this.elevation = 0;

    // カメラの方位角/仰角を計算
    var temp = this.camera.forward.clone();
    temp.y = 0;
    temp.normalize();
    this.azimuth = Math.atan2(-temp.x, -temp.z) * (180 / Math.PI);

    var rot = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, -this.azimuth);
    rot.transformVector(this.camera.forward, temp);
    this.elevation = Math.atan(temp.y, temp.z) * (180 / Math.PI);

    this.forward = 0;
    this.strafe = 0;
    this.jump = false;
    this.cnt = 0;

    app.on('firstperson:forward', function (value) {
        this.forward = value;
    }, this);
    app.on('firstperson:strafe', function (value) {
        this.strafe = value;
    }, this);
    app.on('firstperson:look', function (azimuthDelta, elevationDelta) {
        this.azimuth += azimuthDelta;
        this.elevation += elevationDelta;
        this.elevation = pc.math.clamp(this.elevation, -90, 90);
    }, this);
    app.on('firstperson:jump', function () {
        this.jump = true;
    }, this);
};

FirstPersonView.prototype.postUpdate = function(dt) {
    // カメラの向きを更新
    this.camera.setEulerAngles(this.elevation, this.azimuth, 0);

    // カメラのXZ平面での向きを計算する
    this.z.copy(this.camera.forward);
    this.z.y = 0;
    this.z.normalize();

    this.x.copy(this.camera.right);
    this.x.y = 0;
    this.x.normalize();

    this.heading.set(0, 0, 0);

    // 前後に移動
    if (this.forward !== 0) {
        this.z.scale(this.forward);
        this.heading.add(this.z);
    }

    // 左/右に移動
    if (this.strafe !== 0) {
        this.x.scale(this.strafe);
        this.heading.add(this.x);
    }

    if (this.heading.length() > 0.0001) {
        this.magnitude.set(this.forward, this.strafe);
        this.heading.normalize().scale(this.magnitude.length());
    }

    if (this.jump) {
        this.entity.script.characterController.jump();
        this.jump = false;
    }

    this.entity.script.characterController.move(this.heading);

    var pos = this.camera.getPosition();
    this.app.fire('cameramove', pos);
};


////////////////////////////////////////////////////////////////////////////////
//  FPSキーボードコントロール（移動のみ - マウスルックスクリプトと併用）  //
////////////////////////////////////////////////////////////////////////////////
var KeyboardInput = pc.createScript('keyboardInput');

KeyboardInput.prototype.initialize = function() {
    var app = this.app;

    var updateMovement = function (keyCode, value) {
        switch (keyCode) {
            case 38: // Up 
            case 87: // W
                app.fire('firstperson:forward', value);
                break;
            case 40: // Down 
            case 83: // S
                app.fire('firstperson:forward', -value);
                break;
            case 37: // Left 
            case 65: // A
                app.fire('firstperson:strafe', -value);
                break;
            case 39: // Right 
            case 68: // D
                app.fire('firstperson:strafe', value);
                break;
        }
    };

    var keyDown = function (e) {
        if (!e.repeat) {
            updateMovement(e.keyCode, 1);

            if (e.keyCode === 32) { // Space
                app.fire('firstperson:jump');
            }
        }
    };

    var keyUp = function (e) {
        updateMovement(e.keyCode, 0);
    };

    // DOMイベントリスナーを管理する
    var addEventListeners = function () {
        window.addEventListener('keydown', keyDown, true);
        window.addEventListener('keyup', keyUp, true);
    };
    var removeEventListeners = function () {
        window.addEventListener('keydown', keyDown, true);
        window.addEventListener('keyup', keyUp, true);
    };

    this.on('enable', addEventListeners);
    this.on('disable', removeEventListeners);
    
    addEventListeners();
};


////////////////////////////////////////////////////////////////////////////////
//                         FPSマウスルックコントロール                            //
////////////////////////////////////////////////////////////////////////////////
var MouseInput = pc.createScript('mouseInput');

MouseInput.prototype.initialize = function() {
    var app = this.app;
    var canvas = app.graphicsDevice.canvas;

    var mouseDown = function (e) {
        if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
            canvas.requestPointerLock();
        }
    };

    var mouseMove = function (e) {
        if (document.pointerLockElement === canvas) {
            var movementX = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
            var movementY = event.movementY || event.webkitMovementY || event.mozMovementY || 0;

            app.fire('firstperson:look', -movementX / 5, -movementY / 5);
        }
    };

    // DOMイベントリスナーを管理する
    var addEventListeners = function () {
        window.addEventListener('mousedown', mouseDown, false);
        window.addEventListener('mousemove', mouseMove, false);
    };
    var removeEventListeners = function () {
        window.removeEventListener('mousedown', mouseDown, false);
        window.removeEventListener('mousemove', mouseMove, false);
    };

    this.on('enable', addEventListeners);
    this.on('disable', removeEventListeners);
    
    addEventListeners();
};

// デッドゾーンのタッチとゲームパッド処理のためのユーティリティ関数
// -1から1の範囲の2軸ジョイスティック位置を取る
// 上部と下部のラジアルデッドゾーンを適用
// 範囲の値を0から1に再マッピング。
function applyRadialDeadZone(pos, remappedPos, deadZoneLow, deadZoneHigh) {
    var magnitude = pos.length();
 
    if (magnitude > deadZoneLow) {
        var legalRange = 1 - deadZoneHigh - deadZoneLow;
        var normalizedMag = Math.min(1, (magnitude - deadZoneLow) / legalRange);
        var scale = normalizedMag / magnitude; 
        remappedPos.copy(pos).scale(scale);
    } else {
        remappedPos.set(0, 0);
    }
}

////////////////////////////////////////////////////////////////////////////////
//                 デュアルバーチャルスティックFPSタッチコントロール                      //
////////////////////////////////////////////////////////////////////////////////
var TouchInput = pc.createScript('touchInput');

TouchInput.attributes.add('deadZone', {
    title: 'Dead Zone',
    description: 'Radial thickness of inner dead zone of the virtual joysticks. This dead zone ensures the virtual joysticks report a value of 0 even if a touch deviates a small amount from the initial touch.',
    type: 'number',
    min: 0,
    max: 0.4,
    default: 0.3
});
TouchInput.attributes.add('turnSpeed', {
    title: 'Turn Speed',
    description: 'Maximum turn speed in degrees per second',
    type: 'number',
    default: 150
});
TouchInput.attributes.add('radius', {
    title: 'Radius',
    description: 'The radius of the virtual joystick in CSS pixels.',
    type: 'number',
    default: 50
});
TouchInput.attributes.add('doubleTapInterval', {
    title: 'Double Tap Interval',
    description: 'The time in milliseconds between two taps of the right virtual joystick for a double tap to register. A double tap will trigger a jump.',
    type: 'number',
    default: 300
});

TouchInput.prototype.initialize = function() {
    var app = this.app;
    var graphicsDevice = app.graphicsDevice;
    var canvas = graphicsDevice.canvas;

    this.remappedPos = new pc.Vec2();
    
    this.leftStick = {
        identifier: -1,
        center: new pc.Vec2(),
        pos: new pc.Vec2()
    };
    this.rightStick = {
        identifier: -1,
        center: new pc.Vec2(),
        pos: new pc.Vec2()
    };
    
    this.lastRightTap = 0;

    var touchStart = function (e) {
        e.preventDefault();

        var xFactor = graphicsDevice.width / canvas.clientWidth;
        var yFactor = graphicsDevice.height / canvas.clientHeight;

        var touches = e.changedTouches;
        for (var i = 0; i < touches.length; i++) {
            var touch = touches[i];
            
            if (touch.pageX <= canvas.clientWidth / 2 && this.leftStick.identifier === -1) {
                // If the user touches the left half of the screen, create a left virtual joystick...
                this.leftStick.identifier = touch.identifier;
                this.leftStick.center.set(touch.pageX, touch.pageY);
                this.leftStick.pos.set(0, 0);
                app.fire('leftjoystick:enable', touch.pageX * xFactor, touch.pageY * yFactor);
            } else if (touch.pageX > canvas.clientWidth / 2 && this.rightStick.identifier === -1) {
                // ...otherwise create a right virtual joystick
                this.rightStick.identifier = touch.identifier;
                this.rightStick.center.set(touch.pageX, touch.pageY);
                this.rightStick.pos.set(0, 0);
                app.fire('rightjoystick:enable', touch.pageX * xFactor, touch.pageY * yFactor);
                
                // 右の仮想ジョイスティックの最後のタップからどれくらい経ったかを確認し、ダブルタップ（ジャンプ）を検出
                var now = Date.now();
                if (now - this.lastRightTap < this.doubleTapInterval) {
                    app.fire('firstperson:jump');
                }
                this.lastRightTap = now;
            }
        }
    }.bind(this);

    var touchMove = function (e) {
        e.preventDefault();

        var xFactor = graphicsDevice.width / canvas.clientWidth;
        var yFactor = graphicsDevice.height / canvas.clientHeight;
        
        var touches = e.changedTouches;
        for (var i = 0; i < touches.length; i++) {
            var touch = touches[i];

            // 二つの仮想ジョイスティックの現在の位置を更新
            if (touch.identifier === this.leftStick.identifier) {
                this.leftStick.pos.set(touch.pageX, touch.pageY);
                this.leftStick.pos.sub(this.leftStick.center);
                this.leftStick.pos.scale(1 / this.radius);
                app.fire('leftjoystick:move', touch.pageX * xFactor, touch.pageY * yFactor);
            } else if (touch.identifier === this.rightStick.identifier) {
                this.rightStick.pos.set(touch.pageX, touch.pageY);
                this.rightStick.pos.sub(this.rightStick.center);
                this.rightStick.pos.scale(1 / this.radius);
                app.fire('rightjoystick:move', touch.pageX * xFactor, touch.pageY * yFactor);
            }
        }
    }.bind(this);

    var touchEnd = function (e) {
        e.preventDefault();

        var touches = e.changedTouches;
        for (var i = 0; i < touches.length; i++) {
            var touch = touches[i];

            // このタッチがスティックの一つであれば、それを取り除く...
            if (touch.identifier === this.leftStick.identifier) {
                this.leftStick.identifier = -1;
                app.fire('firstperson:forward', 0);
                app.fire('firstperson:strafe', 0);
                app.fire('leftjoystick:disable');
            } else if (touch.identifier === this.rightStick.identifier) {
                this.rightStick.identifier = -1;
                app.fire('rightjoystick:disable');
            }
        }
    }.bind(this);

    // DOMイベントリスナーを管理する
    var addEventListeners = function () {
        canvas.addEventListener('touchstart', touchStart, false);
        canvas.addEventListener('touchmove', touchMove, false);
        canvas.addEventListener('touchend', touchEnd, false);
    };
    var removeEventListeners = function () {
        canvas.removeEventListener('touchstart', touchStart, false);
        canvas.removeEventListener('touchmove', touchMove, false);
        canvas.removeEventListener('touchend', touchEnd, false);
    };

    this.on('enable', addEventListeners);
    this.on('disable', removeEventListeners);
    
    addEventListeners();
};

TouchInput.prototype.update = function(dt) {
    var app = this.app;
    
    // Moving
    if (this.leftStick.identifier !== -1) {
        // 下部のラジアルデッドゾーンを適用
        applyRadialDeadZone(this.leftStick.pos, this.remappedPos, this.deadZone, 0);

        var strafe = this.remappedPos.x;
        if (this.lastStrafe !== strafe) {
            app.fire('firstperson:strafe', strafe);
            this.lastStrafe = strafe;
        }
        var forward = -this.remappedPos.y;
        if (this.lastForward !== forward) {
            app.fire('firstperson:forward', forward);
            this.lastForward = forward;
        }
    }

    // Looking
    if (this.rightStick.identifier !== -1) {
        // 下部のラジアルデッドゾーンを適用
        applyRadialDeadZone(this.rightStick.pos, this.remappedPos, this.deadZone, 0);

        var lookLeftRight = -this.remappedPos.x * this.turnSpeed * dt;
        var lookUpDown = -this.remappedPos.y * this.turnSpeed * dt;
        app.fire('firstperson:look', lookLeftRight, lookUpDown);
    }
};


////////////////////////////////////////////////////////////////////////////////
//                 デュアルアナログスティックFPSゲームパッドコントロール           //
////////////////////////////////////////////////////////////////////////////////
var GamePadInput = pc.createScript('gamePadInput');

GamePadInput.attributes.add('deadZoneLow', { 
    title: 'Low Dead Zone',
    description: 'Radial thickness of inner dead zone of pad\'s joysticks. This dead zone ensures that all pads report a value of 0 for each joystick axis when untouched.',
    type: 'number',
    min: 0,
    max: 0.4,
    default: 0.1
});
GamePadInput.attributes.add('deadZoneHigh', {
    title: 'High Dead Zone',
    description: 'Radial thickness of outer dead zone of pad\'s joysticks. This dead zone ensures that all pads can reach the -1 and 1 limits of each joystick axis.',
    type: 'number',
    min: 0,
    max: 0.4,
    default: 0.1
});
GamePadInput.attributes.add('turnSpeed', {
    title: 'Turn Speed',
    description: 'Maximum turn speed in degrees per second',
    type: 'number',
    default: 90
});

GamePadInput.prototype.initialize = function() {
    var app = this.app;

    this.lastStrafe = 0;
    this.lastForward = 0;
    this.lastJump = false;

    this.remappedPos = new pc.Vec2();
    
    this.leftStick = {
        center: new pc.Vec2(),
        pos: new pc.Vec2()
    };
    this.rightStick = {
        center: new pc.Vec2(),
        pos: new pc.Vec2()
    };


    var addEventListeners = function () {
        window.addEventListener("gamepadconnected", function(e) {});
        window.addEventListener("gamepaddisconnected", function(e) {});
    };
    var removeEventListeners = function () {
        window.removeEventListener("gamepadconnected", function(e) {});
        window.removeEventListener("gamepaddisconnected", function(e) {});
    };

    this.on('enable', addEventListeners);
    this.on('disable', removeEventListeners);
    
    addEventListeners();
};

GamePadInput.prototype.update = function(dt) {
    var app = this.app;

    var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

    for (var i = 0; i < gamepads.length; i++) {
        var gamepad = gamepads[i];

        // スティックが少なくとも2つある場合のみ進行
        if (gamepad && gamepad.mapping === 'standard' && gamepad.axes.length >= 4) {
            // 移動（左スティック）
            this.leftStick.pos.set(gamepad.axes[0], gamepad.axes[1]);
            applyRadialDeadZone(this.leftStick.pos, this.remappedPos, this.deadZoneLow, this.deadZoneHigh);

            var strafe = this.remappedPos.x;
            if (this.lastStrafe !== strafe) {
                app.fire('firstperson:strafe', strafe);
                this.lastStrafe = strafe;
            }
            var forward = -this.remappedPos.y;
            if (this.lastForward !== forward) {
                app.fire('firstperson:forward', forward);
                this.lastForward = forward;
            }

            // 見る（右スティック）
            this.rightStick.pos.set(gamepad.axes[2], gamepad.axes[3]);
            applyRadialDeadZone(this.rightStick.pos, this.remappedPos, this.deadZoneLow, this.deadZoneHigh);

            var lookLeftRight = -this.remappedPos.x * this.turnSpeed * dt;
            var lookUpDown = -this.remappedPos.y * this.turnSpeed * dt;
            app.fire('firstperson:look', lookLeftRight, lookUpDown);

            // ジャンプ（右クラスタの下ボタン）
            if (gamepad.buttons[0].pressed && !this.lastJump) {
                app.fire('firstperson:jump');
            }
            this.lastJump = gamepad.buttons[0].pressed;
        }
    }
};


// タイトルからメインへ.js
// シーン変更.js
class SceneChange extends pc.ScriptType {

    initialize() {
        console.log(pc.extend)
        this.entity.element.on(pc.EVENT_MOUSEDOWN, this.changeScene, this);
    }

    async changeScene() {
        await pc.changeSceneAsync("Untitled");
    }
};

pc.registerScript(SceneChange);










// Change_Scene.js
//load-scene-plugin.js
pc.extend(pc, function () {
    const loadSceneAsync = async (sceneName) => {
        const scene = pc.app.scenes.find(sceneName);
        // console.log(scene)
        return new Promise((resolve, reject) => {
            pc.app.scenes.loadSceneHierarchy(scene.url, (err, parent) => {
                if (!err) {
                    console.log(parent)
                    resolve(parent);
                } else {
                    reject();
                }
            });
        });
    };

    const changeSceneAsync = async (sceneName) => {
        pc.app.scene.root.destroy();
        const root = await loadSceneAsync(sceneName);
        pc.app.scene.root = root;
    };

    return {
        loadSceneAsync,
        changeSceneAsync
    };
}());


function startScene(ent){
    // find関数でシーンの名前を検索する
    var sceneItem = ent.app.scenes.find('title');

    // rootにあるシーン名を取得
    var oldSceneRootEntity = ent.app.root.findByName('Untitled');

    // 引数１のシーンをロードしたらコールバックを呼ぶ
    ent.app.scenes.loadSceneHierarchy(sceneItem, function (err, loadedSceneRootEntity) {
        if (err) {
            console.error(err);
         } else {
            //現在のシーンを破棄してtitleシーンをロード
            oldSceneRootEntity.destroy();
            pc.changeSceneAsync("title");     
        }
    });
}

function clearScene(ent){
    // find関数でシーンの名前を検索する
    var sceneItem = ent.app.scenes.find('clear');

    // rootにあるシーン名を取得
    var oldSceneRootEntity = ent.app.root.findByName('Untitled');

    // 引数１のシーンをロードしたらコールバックを呼ぶ
    ent.app.scenes.loadSceneHierarchy(sceneItem, function (err, loadedSceneRootEntity) {
        if (err) {
            console.error(err);
         } else {
            //現在のシーンを破棄してtitleシーンをロード
            oldSceneRootEntity.destroy();
            pc.changeSceneAsync("clear");     
        }
    });
}


// timer.js
var Timer = pc.createScript('timer');

// エンティティごとに一度だけ呼び出される初期化コード
Timer.prototype.initialize = function() {
    this.app.score = 50;
    this.entity.element.text = this.app.score
};

// フレームごとに呼び出される更新コード
Timer.prototype.update = function(dt) {
    this.app.score -= dt
    this.entity.element.text = Math.trunc(this.app.score)
    if(this.entity.element.text <= 0){
        console.log(this)
        startScene(this)
    }
};



// point.js
var Point = pc.createScript('point');

// エンティティごとに一度だけ呼び出される初期化コード
Point.prototype.initialize = function () {
    // console.log(this.entity)
    this.entity.collision.on('collisionstart', this.onCollisionPoint, this)
    // this.entity.collision.on('collisionstart', this.onCollisionStart, this);
};

// フレームごとに呼び出される更新コード
Point.prototype.update = function (dt) {

};

Point.prototype.onCollisionPoint = function (event) {
    let other = event.other
    if (other.collision) {
        console.log('point入りました！！！！！！！')
        // pointというタグが付いたエンティティの配列を取得
        var pointText = this.app.root.findByTag('pointText');
        console.log(pointText)
        let resultPoint = parseInt(pointText[0].element.text)
        resultPoint += 10
        pointText[0].element.text = resultPoint
        this.entity.destroy()
        if(pointText[0].element.text === '40'){
            console.log('クリア')
            clearScene(this)
        }
    }
}

// movement.js


var Movement = pc.createScript('movement');


// エンティティごとに一度だけ呼び出される初期化コード
Movement.prototype.initialize = function() {
    console.log(this.entity)
    this.entity.collision.on('collisionstart', this.onCollisionRakka, this);
    yuka = false
    nobori = false
    flag = false
};

// フレームごとに呼び出される更新コード
Movement.prototype.update = function(dt) {
    console.log(yuka)
    if(yuka == false && nobori == false && flag ==false){
        var lp = this.entity.getLocalPosition();
        let yo = lp.y -= 0.1
        if(yo < 0.1){
            yo = 0.1
        }
        this.entity.setPosition(lp.x, yo, lp.z);

    //坂を登り終わった後の処理
    }else if(yuka == true && nobori == false && flag == true){
        
        endTime = Date.now(); // 終了時間
        console.log(endTime - startTime); // 何ミリ秒かかったかを表示する
        if(endTime - startTime > 700){
            flag = false
            yuka = false
            startTime = 0
        }
        
       
        console.log('aaaaaaa')
    }
};

Movement.prototype.onCollisionRakka = function (event) {
    var other = event.other;
    if (other.rigidbody) {
        if(other.tags.has('nobori')){
            startTime = Date.now(); // 開始時間
            console.log('noboriに接触')
            nobori = true
            var lp = this.entity.getLocalPosition();
            let yo = lp.y += 0.1

            this.entity.setPosition(lp.x, yo, lp.z);
            nobori = false
            yuka = true
            flag = true
            
            
        }else if(other.tags.has('yuka')){
            if(other.tags.has('yuka')){
            yuka = true
            nobori = false
            flag = false
            }

        }

    }
}

Movement.prototype.onCollisionRakka_leave = function(event){
    var otherLeave = event.other;
    if (otherLeave.rigidbody) {
        if(other.tags.has('nobori')){
            console.log('はなれた')
        }
    }
}

// nobori.js
var Nobori = pc.createScript('nobori');

// エンティティごとに一度だけ呼び出される初期化コード
Nobori.prototype.initialize = function() {
    this.entity.collision.on('collisionstart', this.onCollisionNobori, this);
};

// フレームごとに呼び出される更新コード
Nobori.prototype.update = function(dt) {

};


Nobori.prototype.onCollisionNobori = function (event) {
        var other = event.other;
        if(other.tags.has('nobori')){
            var lp = this.entity.getLocalPosition();
            let yo = lp.y += 0.01
            this.entity.setPosition(lp.x, yo, lp.z);
        }
}


