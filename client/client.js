(function () {
  var self = this['quando'] = {}
  self.idle_reset_ms = 0
  self.idle_callback_id = 0
  self._displays = new Map()
  self.pinching = false

  //ok, so these following variables attempt to track the inventory and puzzList
  //lists as they change, by performing success checks on initalization of when
  //blocks/calls of the change methods. If the success checks are valid, then
  //the code supplied in the block's boxes are called.

  //inventory management variables
  self.inventory = []
  self.watching_inv = false;
  self.item_to_watch = ''

  //puzzle tracking variables
  self.puzzList = []
  self.watching_puzz = false;
  self.puzzGoal = ''
  
  var _lookup = {} // holds run time arrays

  self.socket = io.connect('http://' + window.location.hostname)

  function _displayWidth() {
    return window.innerWidth
  }

  function _displayHeight() {
    return window.innerHeight
  }

  //empty functions for inventory and puzzle tracking
  self.on_inv_match = function() {}
  self.on_puzz_success = function() {}

  //add/remove elements to inventory
  self.change_inv = function(changeType, item) {

    if (changeType == 'add') {
      self.inventory.push(item);
      alert(item + ' added to inventory!')
    } else { //must be remove
      if (self.inventory.includes(item)) {
        //remove item from wherever it is in array
        self.inventory.splice(self.inventory.indexOf(item), 1);
        alert(item + 'used!')
      } else {
        alert(item + ' is not in inventory...')
      }
    }
    
    //if we're watching the inventory, and the inventory contains what it should
    //we fire the function specified in the handler
    if (self.watching_inv == true) {
      if (self.inventory.includes(item)) {
        self.on_inv_match()
        self.stop_inv_tracking()
      }
    }

  }

  self.get_inv = function() {
    return self.inventory;
  }

  //shows inv as label, could do with replacing label to custom element for UX reasons
  self.show_inv = function() {
    self.addLabelStatement('Inventory: '+self.get_inv().toString(), ()=>{})
  }

  //initialise inventory watching
  self.init_inv_watch = function(item, fn) {
    self.watching_inv = true
    self.item_to_watch = item
    self.on_inv_match = fn

    //if we're watching the inventory, and the inventory contains what it should
    //we fire the function specified in the block
    if (self.inventory.includes(item)) {
      alert(item + ' is in inv...')
      self.on_inv_match()
      self.stop_inv_tracking()
    }
  }

  //reset params, stop watching inv
  self.stop_inv_tracking = function() {
    self.watching_inv = false;
    self.item_to_watch = ''
    self.on_inv_match = function() {}
  }

  //initialize puzzle tracker
  self.init_puzz = function(goal, fn) {
    self.puzzGoal = goal
    self.watching_puzz = true
    self.on_puzz_success = fn

    //if we're watching the puzzle, and it is the goal, do what's in the block box
    if (self.watching_puzz == true) {
      if (self.get_puzzList() == self.puzzGoal) {
        alert('yeet')
        self.on_puzz_success()
      }
    }
  }

  //add/remove elements to puzzle list
  self.change_puzzList = function(changeType, data) {
    if (changeType == 'add') {
      self.puzzList.push(data);
    } else {
      self.puzzList.splice(self.puzzList.indexOf(data), 1);
    }

    if (self.puzzList == self.puzzGoal) {
      alert('yeet')
      self.on_puzz_success()
    }
  }

  self.get_puzzList = function() {
    //remove the commas between elements added when using toString()
    alert(self.puzzList.toString().replace(/,/g, ''))
    return (self.puzzList.toString().replace(/,/g, ''))
  }

  self.clear_puzzList = function() {
    self.puzzList =''
    alert('puzzle tracker cleared...')
  }

  //stop puzzle tracking, resetting params
  self.stop_puzz_tracking = function() {
    self.puzzGoal = ''
    self.watching_puzz = false
    self.on_puzz_success = function() {}
  }

  self.socket.on('deploy', function (data) {
    var locStr = decodeURIComponent(window.location.href)
    if (locStr.endsWith('/'+data.script)) {
      window.location.reload(true) // nocache reload - probably not necessary
    }
  })

  self.add_message_handler = function (message, fn) {
    self.socket.on(message, fn)
    self.destructor.add( () => {
      self.socket.off(message, fn)
    })
  }

  self.send_message = function(message, val) {
    fetch('/message/' + message, { method: 'POST', 
      body: JSON.stringify({'val':val}), 
      headers: {"Content-Type": "application/json"}
    })
  }

  self.idle_reset = function () {
    if (self.idle_reset_ms > 0) {
      clearTimeout(self.idle_callback_id)
      self.idle_callback_id = setTimeout(self.idle_callback, self.idle_reset_ms)
    } else { // this means we are now idle and must wakeup
      if (self.idle_active_callback) {
        self.idle_active_callback()
      }
    }
  }

  document.onmousemove = self.idle_reset
  document.onclick = self.idle_reset
  document.onkeydown = self.idle_reset
  document.onkeyup = self.idle_reset

  self.dispatch_event = function (event_name, data = false) {
    if (data) {
      document.dispatchEvent(new CustomEvent(event_name, data))
    } else {
      document.dispatchEvent(new CustomEvent(event_name))
    }
  }

  self.add_handler = function (event, callback) {
    document.addEventListener(event, callback)
    self.destructor.add( () => {
      document.removeEventListener(event, callback)
    })
  }

  self.add_scaled_handler = function (event_name, callback, scaler) {
    var handler = function (ev) {
      var value = scaler(ev.detail)
      if (value !== null) {
        callback(value)
      }
    }
    quando.add_handler(event_name, handler)
  }

  self.new_scaler = function (min, max, inverted = false) {
    return function (value) {
      // convert to range 0 to 1 for min to max
      var result = (value - min) / (max - min)
      result = Math.min(1, result)
      result = Math.max(0, result)
      if (inverted) {
        result = 1 - result
      }
      return result
    }
  }

  self.new_angle_scaler = function (mid, plus_minus, inverted = false) {
    var mod = function(x, n) {
        return ((x%n)+n)%n
    }
    var last_result = 0
    var crossover = mod(mid+180, 360)
    // i.e. 25% of the non used range
    var crossover_range = (180 - Math.abs(plus_minus)) / 4
    return function (value) {
      var x = mod(value - mid, 360)
      if (x > 180) { x -= 360}
      var result = (x + plus_minus) / (2 * plus_minus)
      if (inverted) {
        result = 1 - result
      }
      if ((result < 0) || (result > 1)) { // i.e. result is out of range
            // identify if result should be used
            var diff = Math.abs(crossover - mod(value, 360))
            if (diff <= crossover_range) { // inside crossover range, so use the last result 
                result = last_result
            }
      }
      result = Math.min(1, result)
      result = Math.max(0, result)
      last_result = result
      return result
    }
  }

  // Start in the middle
  self._y = _displayHeight()
  self._x = _displayWidth()

  function _cursor_adjust () {
    var x = self._x
    var y = self._y
    var style = document.getElementById('cursor').style
    var max_width = _displayWidth()
    var max_height = _displayHeight()
    if (x < 0) {
      x = 0
    } else if (x > max_width) {
      x = max_width
    }
    if (y < 0) {
      y = 0
    } else if (y > max_height) {
      y = max_height
    }
    style.top = y + 'px'
    style.left = x + 'px'
    style.visibility = 'hidden' // TODO this should only be done once - maybe an event (so the second one can be consumed/ignored?)
    var elem = document.elementFromPoint(x, y)
    style.visibility = 'visible'
    self.hover(elem)
    self.idle_reset()
  }

  self.cursor_up_down = function (mid, range, inverted, y) {
    min = mid-range
    max = mid+range
    min /= 100
    max /= 100
    if (y === false) {
      y = (min + max)/2
    }
    if (!inverted) {
      y = 1 - y // starts inverted
    }
    var scr_min = min * _displayHeight()
    var scr_max = max * _displayHeight()
    self._y = scr_min + (y * (scr_max-scr_min))
    _cursor_adjust()
  }

  self.cursor_left_right = function (mid, range, inverted, x) {
    min = mid-range
    max = mid+range
    min /= 100
    max /= 100
    if (x === false) {
      x = (min + max)/2
    }
    if (inverted) {
      x = 1 - x // starts normal
    }
    var scr_min = min * _displayWidth()
    var scr_max = max * _displayWidth()
    self._x = scr_min + (x * (scr_max-scr_min))
    _cursor_adjust()
  }

  var Config = self.Config = {
  }

  self.idle = function (count, units, idle_fn, active_fn) {
    clearTimeout(self.idle_callback_id)
    let time_secs = self.idle_reset_ms = self.time.units_to_ms(units, count)
    self.idle_callback = () => {
      self.idle_reset_ms = 0 // why - surely I need to intercept self.idle_reset
            // actually - this will work to force self.idle_reset to call idle_active_callback instead
      idle_fn()
    }
    self.idle_active_callback = () => {
      clearTimeout(self.idle_callback_id)
      self.idle_reset_ms = time_secs // resets to idle detection
      self.idle_callback_id = setTimeout(self.idle_callback, self.idle_reset_ms)
            // so, restarts timeout when active
      active_fn()
    }
    self.idle_callback_id = setTimeout(self.idle_callback, self.idle_reset_ms)
  }

  function _set_or_append_tag_text(txt, tag, append) {
    var elem = document.getElementById(tag)
    if (typeof txt === 'function') {
      // HACK: N.B. This may be a security worry?!
      txt = txt()
    }    
    if (append) {
      txt = elem.innerHTML + txt
    }
    if (!txt) {
      elem.style.visibility = 'hidden'
      txt = ''
    } else {
      elem.style.visibility = 'visible'
    }
    elem.innerHTML = txt
  }
  
  self.title = function (text = '', append = false) {
    _set_or_append_tag_text(text, 'quando_title', append)
  }

  self.text = function (text = '', append = false) {
    _set_or_append_tag_text(text, 'quando_text', append)
  }

  self.projection = function (front = true) {
    let scale = 1
    if (!front) {
      scale = -1
    }
    document.getElementById('html').style.transform = 'scale(' + scale + ',1)'
  }

  self.image_update_video = function (img) {
    var image = document.getElementById('quando_image')
    if (image.src != encodeURI(window.location.origin + img)) {
            // i.e. only stop the video when the image is different - still need to set the image style...
            // TODO this needs checking for behavioural side effects
      self.clear_video()
    }
  }

  self.video = function (vid, loop = false) {
    if (vid) {
      vid = '/client/media/' + encodeURI(vid)
    }
    var video = document.getElementById('quando_video')
    video.loop = loop
    if (video.src != encodeURI(window.location.origin + vid)) { // i.e. ignore when already playing
      if (video.src) {
        video.pause()
      }
      video.src = vid
      video.autoplay = true
      video.addEventListener('ended', self.clear_video)
      video.style.visibility = 'visible'
      video.load()
    }
  }

  self.clear_video = function () {
    var video = document.getElementById('quando_video')
    video.src = ''
    video.style.visibility = 'hidden'
    // Remove all event listeners...
    video.parentNode.replaceChild(video.cloneNode(true), video)
  }

  self.audio = function (audio_in, loop = false) {
    if (audio_in) {
      audio_in = '/client/media/' + encodeURI(audio_in)
    }
    var audio = document.getElementById('quando_audio')
    audio.loop = loop
    if (audio.src != encodeURI(window.location.origin + audio_in)) { // src include http://127.0.0.1/
      if (audio.src) {
        audio.pause()
      }
      audio.src = audio_in
      audio.autoplay = true
      audio.addEventListener('ended', self.clear_audio)
      audio.load()
    }
  }

  self.clear_audio = function () {
    var audio = document.getElementById('quando_audio')
    audio.src = ''
    // Remove all event listeners...
    audio.parentNode.replaceChild(audio.cloneNode(true), audio)
  }

  self.hands = function (count, do_fn) {
    var hands = 'None'
    var handler = function () {
      frame = self.leap.frame()
      if (frame.hands) {
        self.idle_reset() // any hand data means there is a visitor present...
        if (frame.hands.length !== hands) {
          hands = frame.hands.length
          if (hands === count) {
            do_fn()
          }
                    //                }
        }
      }
    }
    if (self.leap) {
      self.time.every({count: 1/20}, handler)
    } else {
      self.leap = new Leap.Controller()
      self.leap.connect()
      self.leap.on('connect', function () {
        self.time.every({count: 1/20}, handler)
      })
    }
  }

  self.handed = function (left, right, do_fn) {
    var handler = function () {
// FIX very inefficient...
      frame = self.leap.frame()
      var now_left = false
      var now_right = false
      if (frame.hands) {
        self.idle_reset() // any hand data means there is a visitor present...
        if (frame.hands.length !== 0) {
          var hands = frame.hands
          for (var i = 0; i < hands.length; i++) {
            var handed = hands[i].type
            if (handed === 'left') {
              now_left = true
            }
            if (handed === 'right') {
              now_right = true
            }
          }
        }
      }
      if ((now_right === right) && (now_left === left)) {
        do_fn()
      }
    }
    if (self.leap) {
      self.time.every({count: 1/20}, handler)
    } else {
      self.leap = new Leap.Controller()
      self.leap.connect()
      self.leap.on('connect', function () {
        self.time.every({count: 1/20}, handler)
      })
    }
  }

  self.display = function (key, fn) { // Yes this is all of it...
    self._displays.set(key, fn)
  }

  self._removeFocus = function () {
    var focused = document.getElementsByClassName('focus')
    for (var focus of focused) {
      focus.classList.remove('focus')
      focus.removeEventListener('transitionend', self._handle_transition)
    }
  }
  self._handle_transition = function (ev) {
    ev.target.click()
  }

  self.startDisplay = function () {
    setTimeout( () => {
      self.style.set(self.style.DEFAULT, '#cursor', 'background-color', 'rgba(255, 255, 102, 0.7)');
      self.style.set(self.style.DEFAULT, '#cursor', 'width', '4.4vw');
      self.style.set(self.style.DEFAULT, '#cursor', 'height', '4.4vw');
      self.style.set(self.style.DEFAULT, '#cursor', 'margin-left', '-2.2vw');    
      self.style.set(self.style.DEFAULT, '#cursor', 'margin-top', '-2.2vw');    
      document.querySelector('body').addEventListener('contextmenu', // right click title to go to setup
              function (ev) {
                ev.preventDefault()
                window.location.href = '../../client/setup'
                return false
              }, false)
      self.pinching = false
      exec() // this is the function added by the generator
      let first = self._displays.keys().next()
      if (first && !first.done) {
        self.showDisplay(first.value) // this runs the very first display :)
      }
    }, 0)
  }

  self.hover = function (elem) {
    if (elem) {
      if (!elem.classList.contains('focus')) { // the element is not in 'focus'
                // remove focus from all other elements - since the cursor isn't over them
        self._removeFocus()
        if (elem.classList.contains('quando_label')) {
          elem.classList.add('focus')
          elem.addEventListener('transitionend', self._handle_transition)
        }
      }
    } else {
            // remove focus from any elements - since the cursor isn't over any
      self._removeFocus()
    }
  }

  self.showDisplay = function (id) {
    // perform any destructors - which will cancel pending events, etc.
    // assumes that display is unique...
    self.destructor.destroy()
    // Clear current labels, title and text
    document.getElementById('quando_labels').innerHTML = ''
    self.title()
    self.text()
    //clear AR 
    quando.AR.clear()
//        self.video() removed to make sure video can continue playing between displays
    self.style.reset()
    // Find display and execute...
    self._displays.get(id)()
  }

  self.addLabel = function (id, title) {
    self.addLabelStatement(title, () => { setTimeout( () => { quando.showDisplay(id) }, 0) })
  }

  self.addLabelStatement = function (title, fn) {
    var elem = document.getElementById('quando_labels')
    var div = document.createElement('div')
    div.className = 'quando_label'
    div.innerHTML = title
    elem.appendChild(div)
    div.onclick = fn
  }

  self.addQuestion = function (answer, fn) {
    var elem = document.getElementById('quando_labels')
    var div = document.createElement('div')
    var input = document.createElement('input')
    var button = document.createElement('button')

    div.className = 'quando_label'
    input.type = "text"
    input.className = "quando_input"
    button.innerHTML = "sumbit"

    div.appendChild(input)
    div.appendChild(button)
    elem.appendChild(div)

    //on submit button being pressed, check if user's answer is right
    button.addEventListener("click", function(){
      if (input.value == answer) {
        fn()
      } else {
        button.innerHTML = "Nah try again..."
      }
    })
    
  } 

  self.pick = function(val, arr) {
    if (val === false) {
      val = 0.5
    }
    var i = Math.floor(val * arr.length)
    if (i == arr.length) {
      i--
    }
    arr[i]()
  }

  self.pick_random = function(arr) {
    var r = Math.random()
    self.pick(r, arr)
  }

  self.pick_one_each_time = function(arr) {
    if (arr.length > 0) {
      if (!arr.hasOwnProperty('index')) {
        arr.index = 0
      }
      var fn = arr[arr.index]
      if (++arr.index >= arr.length) {
        arr.index = 0
      }
      if (typeof fn === 'function') { fn() }
    }
  }

  self.setOnId = (id, val) => {
    _lookup[id] = val
  }

  self.getOnId = (id) => {
    return _lookup[id]
  }

  self.vary_each_time = function(fn, end_value, inverted, seesaw) {
    end_value--
    if (end_value < 1) { // Avoid infinite answers...
      end_value = 1
    }
    if (!fn.hasOwnProperty('counter')) {
      fn.counter = 0
      fn.direction = 1 // go up at the start - inverted will flip the final result...
    }
    // calculate the current value, then adjust the counter to the next value...
    let val = fn.counter/end_value
    if (inverted) {
      val = 1 - val
    }
    fn.counter += fn.direction
    if (fn.counter < 0) {
      if (seesaw) {
        fn.counter = 1 // i.e. next time is one more than the 0 minimum
        fn.direction = 1
      } else {
        fn.counter = end_value // logically this can't happen now...
      }
    }
    if (fn.counter > end_value) {
      if (seesaw) {
        fn.counter = end_value - 1 // next value is one less than the maximum
        fn.direction = -1
      } else {
        fn.counter = 0 // back to start
      }
    }
    if (typeof fn === 'function') { fn.call(this, val) }
  }

  function _degrees_to_radians (degrees) {
      var radians = Math.PI * degrees / 180
      return radians
  }

  self.convert_angle = (val, mid, range, inverted) => {
    if (val === false) { val = 0.5 }
    if (inverted) { val = 1 - val }
    let min = _degrees_to_radians(mid - range)
    let max = _degrees_to_radians(mid + range)
    return min + (val * (max-min))
  }

  self.clear = (display, title, text, image, video, audio, object3d, speech) => {
    if (title) { self.title(display) }
    if (text) { self.text(display) }
    if (image) { self.image.set(display) }
    if (video) { self.video('',false) }
    if (audio) { self.audio('',false) }
    if (object3d) { self.object3d.clear() }
    if (speech) { self.speech.clear() }
  }
})()

var val = false // force handler to manage when not embedded

if (document.title == "[[TITLE]]") { // this was opened by Inventor >> Test
  document.title = "TEST"
  let script = document.getElementById("quando_script")
  if (script) {
    script.parentNode.removeChild(script)
  }
  let exec = window.opener.index.clientScript()
  eval("this['exec'] =  () => {\n" + exec + "\n}")
}