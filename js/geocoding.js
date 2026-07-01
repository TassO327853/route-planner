// geocoding.js - 高德地图地理编码

const Geocoding = {
  // 地址 → 经纬度（高德地理编码 API）
  async addressToCoord(address) {
    return new Promise((resolve, reject) => {
      AMap.plugin('AMap.Geocoder', () => {
        const geocoder = new AMap.Geocoder();
        geocoder.getLocation(address, (status, result) => {
          if (status === 'complete' && result.geocodes.length > 0) {
            const { lng, lat } = result.geocodes[0].location;
            resolve({ lat, lng, formattedAddress: result.geocodes[0].formattedAddress });
          } else {
            reject(new Error('地址解析失败：' + address));
          }
        });
      });
    });
  },

  // 经纬度 → 地址（高德逆地理编码）
  async coordToAddress(lat, lng) {
    return new Promise((resolve, reject) => {
      AMap.plugin('AMap.Geocoder', () => {
        const geocoder = new AMap.Geocoder();
        geocoder.getAddress([lng, lat], (status, result) => {
          if (status === 'complete') {
            resolve(result.regeocode.formattedAddress);
          } else {
            reject(new Error('逆地理编码失败'));
          }
        });
      });
    });
  }
};
