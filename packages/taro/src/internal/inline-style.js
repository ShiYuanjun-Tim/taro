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

const flexConatinerProps = ['flexDirection', 'justifyContent', 'alignItems']
function array2obj (arrayable) {
  if (Array.isArray(arrayable)) {
    const obj = arrayable.reduce((total, curr) => {
      const objfy = array2obj(curr)
      return Object.assign(total, objfy)
    }, {})
    return obj
  }
  return arrayable
};

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
  let allStyle = array2obj(obj)

  if (!isObject(allStyle)) {
    throw new TypeError('style 只能是一个对象或字符串。')
  }

  // detect whether the component is used as a flex box

  if (flexConatinerProps.some(prop => (prop in allStyle))) {
    allStyle['display'] = 'flex'
  }

  const addtionalSty = []
  const dashified = Object.keys(allStyle).map((key) => {
    let val = allStyle[key]
    // 添加单位
    if (sizeableStyleKey.test(key) && typeof val === 'number') {
      val += 'px'
    }
    // 检测border 属性 rn中的borderStyle 一般都不设置 但是wx需要
    const borderSet = /^border(.*)(?:width)$/i.exec(key)
    if (borderSet && !('borderStyle' in allStyle)) {
      const borderstyleKey = `border${borderSet[1]}Style`
      addtionalSty.push(dashify(borderstyleKey) + ':solid')
    }
    return dashify(key).concat(':').concat(val)
  })

  return addtionalSty.concat(dashified).join(';')
}

const sizeableStyleKey = /^(width)|(height)|(top)|(bottom)|(right)|(left)|(border.*width)|(border.*radius)|(fontSize)|(padding.*)|(margin.*)$/i
