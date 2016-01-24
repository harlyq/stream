//(function() {
  function stream(f) {
    this.f = f
    this.children = []
  }
  
  stream.prototype.pipe = function(f) {
    // chained pipe() will be children of children
    var s = new stream(f)
    this.children.push(s)
    return s
  }
  
  stream.prototype.reset = function() {}
  
  stream.prototype.push = function(x) {
    var y
    if (typeof this.f === 'function')
      y = this.f.call(null, x)
    else
      y = x
      
    // each child receives the same data
    if (typeof y !== 'undefined') {
      for (var i = 0; i < this.children.length; ++i) {
        this.children[i].push(y)
      }
    }
  }
  
  stream.prototype.map = function(f) {
    return this.pipe((x) => { 
      return f.call(null, x) 
    })
  }
  
  stream.prototype.filter = function(f) {
    return this.pipe((x) => { 
      if (f.call(null, x)) {
        return x 
      }
    })
  }

  // f(f0, x) the first parameter is the state, the second is the new value
  stream.prototype.fold = function(f, f0) {
    return this.pipe((x) => { 
      var f1 = f.call(null, f0, x)
      if (typeof f1 !== 'undefined') {
        f0 = f1 // replace the old starting value
        return f1
      }
    })
  }

  stream.prototype.log = function() {
    return this.pipe((x) => {
      console.log(x)
    })
  }
  
  stream.prototype.split = function(i) {
    return this.pipe((x) => {
      return x[i]
    })
  }
  
  stream.prototype.sampleAt = function(t) {
    var lastValue
    var self = this.pipe(function(x) {
      lastValue = x
    })
    
    window.setInterval(function() {
      if (lastValue !== undefined) {
        for (var i = 0; i < self.children.length; ++i) {
          self.children[i].push(lastValue)
        }
      }
    }, t)
    
    return self
  }
  
  function eventStream(selector, name) {
    var s = new stream()
    var handler = function(e) {
      s.push(e)
    }          
    var elements = document.querySelectorAll(selector)
    
    s.reset = function() {
      element.removeEventListener(name, handler)
    }
    
    for (var i = 0; i < elements.length; ++i) {
      elements[i].addEventListener(name, handler)
    }
    
    return s
  }
  
  function intervalStream(periodms) {
    var s = new stream()
    var count = 0          
    var id = setInterval(() => { s.push(++count) }, periodms)
    
    s.reset = function() {
      clearTimeout(id)
    }
    return s
  }
  
  function keyArrowStream(selector) {
    selector = selector || "body"
    
    var s = new stream()
    var elements = document.querySelectorAll(selector)
    var state = {}

    var pushArrows = function() {
      var arrows = {x:0, y:0}
      for (key in state) {
        switch (key) {
          case "ArrowDown": arrows.y -= 1; break;
          case "ArrowUp": arrows.y += 1; break;
          case "ArrowLeft": arrows.x -= 1; break;
          case "ArrowRight": arrows.x += 1; break;
        }
      }
      s.push(arrows)
    }
    
    var downHandler = function(e) {
      var send = false
      var key = e.key
      if (key === undefined)
        key = "Arrow" + e.keyIdentifier
      
      switch (key) {
        case "ArrowDown":
        case "ArrowUp":
        case "ArrowLeft":
        case "ArrowRight":
          state[key] = true
          send = true
      }
      if (send)
        pushArrows()
    }
    
    var upHandler = function(e) {
      var key = e.key
      if (key === undefined)
        key = "Arrow" + e.keyIdentifier

      var send = false
      switch (key) {
        case "ArrowDown": 
        case "ArrowUp":
        case "ArrowLeft": 
        case "ArrowRight": 
          delete state[key]
          send = true
      }
      if (send)
        pushArrows()
    }
    
    for (var i = 0; i < elements.length; ++i) {
      elements[i].addEventListener('keydown', downHandler)
      elements[i].addEventListener('keyup', upHandler)
    }
    
    return s
  }
  
  function copyPOD(obj) {
      if (typeof obj !== "object" || obj === null)
        return obj
      
      if (obj instanceof Array) {
        var copy = []
        for (var i = 0; i < obj.length; ++i)
          copy[i] = copyPOD(obj[i])
        return copy
      } 
      else if (obj instanceof Object) {
        var copy = {}
        for (var key in obj) {
          if (obj.hasOwnProperty(key))
            copy[key] = copyPOD(obj[key])
        }
        return copy
      }
  }
  
  // each argument is a stream to merge
  function mergeStreams(mode) {          
    var numStreams = arguments.length - 1
    var buffer = []
    var s = new stream()
    var addPipe = function(child, mode, index) {
      child.pipe((x) => {
        buffer[index] = x // remember stream's value
        
        var numReady = 0
        for (var k = 0; k < numStreams; ++k) {
          if (typeof buffer[k] !== "undefined") {
            numReady++
          }
        }
        
        var isReady = false
        if (mode === "all")
          isReady = numReady == numStreams
        else if (mode === "any")
          isReady = numReady > 0
        else if (typeof mode === "number")
          isReady = numReady > mode

        if (isReady) {
          var result = buffer.slice()
          buffer.length = 0
          s.push(result) // start merged stream
        }
        
        return x // continue individual streams
      })
    }
    
    for (var i = 0; i < numStreams; ++i) {
      addPipe(arguments[i + 1], mode, i)
    }

    return s
  }
//})()
