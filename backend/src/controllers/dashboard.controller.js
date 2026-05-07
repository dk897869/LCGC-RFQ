exports.getDashboard = async (req,res)=>{

  res.json({
    success:true,
    data:{
      totalRequests:156,
      pending:23,
      approved:89,
      successRate:94.2
    }
  });

};