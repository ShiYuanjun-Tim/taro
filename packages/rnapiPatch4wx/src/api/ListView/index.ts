export default  class ListView {
  public static DataSource = class {
    cloneWithRows(dataBlob, rowIdentities){ return dataBlob }
    cloneWithRowsAndSections(){throw new Error('to be implement if necessary')}
    getRowCount(){throw new Error('to be implement if necessary')}
    getRowAndSectionCount(){throw new Error('to be implement if necessary')}
    rowShouldUpdate(){throw new Error('to be implement if necessary')}
    getRowData(){throw new Error('to be implement if necessary')}
    getRowIDForFlatIndex(){throw new Error('to be implement if necessary')}
    getSectionIDForFlatIndex(){throw new Error('to be implement if necessary')}
    getSectionLengths(){throw new Error('to be implement if necessary')}
    sectionHeaderShouldUpdate(){throw new Error('to be implement if necessary')}
    getSectionHeaderData(){throw new Error('to be implement if necessary')}
  }
}