import invariant from '../../invariant'

const StyleSheet = {
 
  compose(style1, style2) {
    if (style1 && style2) {
      return [style1, style2];
    } else {
      return style1 || style2;
    }
  },
  create(styles) {
    // const result = {};
    // Object.keys(styles).forEach(key => {

    //   const id = styles[key] && ReactNativePropRegistry.register(styles[key]);
    //   result[key] = id;
    // });
    return styles;
  },
  flatten: function(){invariant(0,'not implemented yet')},
  hairlineWidth: 1
};

export default StyleSheet;