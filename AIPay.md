数据结构
模型type 对应的token计算方法

增加一个接口，外部调用，然后给特殊权限
接口参数：用户地址，模型的t使用量，
需要记录一个数据结构
{
  user: address
  tokensamount: uint256
  currentrate:  uint256
  toprate:      uint256
}

### 合约编译
```shell

```

### 合约部署
```shell

```


### 测试样例
1. 用户质押成功

2. 用户质押数量为0 失败，
3. 用户

### 事件
用户u流入
deposit合约
event DepositMade(address indexed user, uint256 usdtAmount, uint256 rate，uint256 currentBalance);

结算扣u
deposit合约
event UserBalanceUpdated(address indexed user, uint256 newBalance, bool directory, uint256 currentBalance);

结算worker增top
event WorkerTopBalanceUpdated(address indexed user, uint256 newBalance,bool directory, uint256 currentBalance);
worker提top
event WorkerTopBalanceWithdraw(address indexed user, uint256 newBalance, bool directory, uint256 currentBalance);

管理员账户管理
bank合约
event USDTWithdrawn(address indexed to, uint256 amount);
event TOPWithdrawn(address indexed to, uint256 amount);
