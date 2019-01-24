 const Platform = {
  OS: 'wx',
  select: (obj: any) => 'wx' in obj ? obj.wx : obj
};

export default Platform;