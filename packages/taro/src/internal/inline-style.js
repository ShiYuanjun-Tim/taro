const upperCasePattern = /([A-Z])/g

function dashify (str) {
  return str.replace(upperCasePattern, dashLower)
}

function dashLower (c) {
  return '-' + c.toLowerCase()
}

function isObject (val) {
  return val != null && typeof val === 'object' && Array.isArray(val) === false
}

export function inlineStyle (obj) {
  if (obj == null) {
    return ''
  }
  if (typeof obj === 'string') {
    return obj
  }

  if (obj === null || obj === undefined) {
    return ''
  }
  // GAI:3 - combine style array
  let allStyle = obj
  if (Object.prototype.toString.call(obj) === '[object Array]') {
    allStyle = obj.reduce((total, curr) => {
      return Object.assign(total, curr)
    }, {})
  }

  if (!isObject(allStyle)) {
    throw new TypeError('style 只能是一个对象或字符串。')
  }

  // detect width when flexDirection is row
  if (allStyle.flexDirection === 'row' && !('width' in allStyle)) {
    allStyle['width'] = '100%'
  }
  return Object.keys(allStyle).map((key) => {
    let val = allStyle[key]
    // 添加单位
    if (sizeableStyleKey.test(key) && typeof val === 'number') {
      val += 'rpx'
    }
    return dashify(key).concat(':').concat(val)
  }).join(';')
}

const sizeableStyleKey = /^(width)|(height)|(top)|(bottom)|(right)|(left)|(border.*width)|(border.*radius)|(fontSize)|(padding.*)|(margin.*)$/i
